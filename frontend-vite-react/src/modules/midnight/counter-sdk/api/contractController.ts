import { type Logger } from 'pino';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import * as Rx from 'rxjs';
import { CounterPrivateStateId, CounterProviders, DeployedCounterContract, emptyState, UserAction, type DerivedState } from './common-types';
import { Counter, CounterPrivateState, createPrivateState } from '@eddalabs/counter-contract';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

const counterCompiledContract = CompiledContract.make('counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(`${window.location.origin}/midnight/counter`),
);

export interface ContractControllerInterface {
  readonly deployedContractAddress: ContractAddress;   
  readonly state$: Rx.Observable<DerivedState>;
  submitCompliance: () => Promise<void>;
  revokeCompliance: () => Promise<void>;
}

export class ContractController implements ContractControllerInterface {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Rx.Observable<DerivedState>;
  readonly privateStates$: Rx.Subject<CounterPrivateState>;
  readonly turns$: Rx.Subject<UserAction>;  

  private constructor(
    public readonly contractPrivateStateId: typeof CounterPrivateStateId,
    public readonly deployedContract: DeployedCounterContract,
    public readonly providers: CounterProviders,
    private readonly logger: Logger,
  ) {
    const combine = (_acc: DerivedState, value: DerivedState): DerivedState => {
      return {
        round: value.round,
        fleetCompliance: value.fleetCompliance,
        privateState: value.privateState,
        turns: value.turns,        
      };
    };
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.turns$ = new Rx.Subject<UserAction>();
    this.privateStates$ = new Rx.Subject<CounterPrivateState>();
    this.state$ = Rx.combineLatest(
      [
        providers.publicDataProvider
          .contractStateObservable(this.deployedContractAddress, { type: 'all' })
          .pipe(Rx.map((contractState) => Counter.ledger(contractState.data))),
        Rx.concat(
          Rx.from(
            Rx.defer(() => providers.privateStateProvider.get(contractPrivateStateId) as Promise<CounterPrivateState>),
          ),
          this.privateStates$,
        ),
        Rx.concat(
          Rx.of<UserAction>({ submitCompliance: undefined, revokeCompliance: undefined }),
          this.turns$,
        ),
      ],
      (ledgerState, privateState, userActions) => {
        const fleetCompliance =
          (ledgerState as Counter.Ledger & { fleetCompliance?: boolean }).fleetCompliance ?? false;
        const result: DerivedState = {
          round: ledgerState.round,
          fleetCompliance,
          privateState: privateState,
          turns: userActions,
        };
        return result;
      },
    ).pipe(
      Rx.scan(combine, emptyState),
      Rx.retry({
        // sometimes websocket fails, if want to add attempts, include count in the object
        delay: 500,
      }),
    );
  }

  private async invokeCircuitMethod(
    methodName: 'submitCompliance' | 'revokeCompliance',
    inProgressText: string,
  ): Promise<void> {
    const callTx = this.deployedContract.callTx as Record<string, () => Promise<{
      public: { txHash: string; blockHeight: bigint };
    }>>;
    const method = callTx[methodName];
    if (typeof method !== 'function') {
      throw new Error(`Contract circuit '${methodName}' is not available in current compiled contract`);
    }

    try {
      this.turns$.next({
        submitCompliance: methodName === 'submitCompliance' ? inProgressText : undefined,
        revokeCompliance: methodName === 'revokeCompliance' ? inProgressText : undefined,
      });
      const txData = await method();
      this.logger?.trace({
        [methodName]: {
          message: `${methodName} transaction completed`,
          txHash: txData.public.txHash,
          blockHeight: txData.public.blockHeight,
        },
      });
      this.turns$.next({
        submitCompliance: undefined,
        revokeCompliance: undefined,
      });
    } catch (e) {
      this.turns$.next({
        submitCompliance: undefined,
        revokeCompliance: undefined,
      });
      throw e;
    }
  }

  async submitCompliance(): Promise<void> {
    this.logger?.info('submitting fleet compliance');
    await this.invokeCircuitMethod('submitCompliance', 'submitting compliance proof');
  }

  async revokeCompliance(): Promise<void> {
    this.logger?.info('revoking fleet compliance');
    await this.invokeCircuitMethod('revokeCompliance', 'revoking compliance');
  }

  static async deploy(
    contractPrivateStateId: typeof CounterPrivateStateId,    
    providers: CounterProviders,
    logger: Logger,
  ): Promise<ContractController> {
    logger.info({
      deployContract: {
        action: "Deploying contract",
        contractPrivateStateId, 
        providers       
      },
    });    
    const deployedContract = await deployContract(providers, {
      compiledContract: counterCompiledContract,
      privateStateId: contractPrivateStateId,
      initialPrivateState: await ContractController.getPrivateState(contractPrivateStateId, providers.privateStateProvider),
    });

    logger.trace({
      contractDeployed: {
        action: "Contract was deployed",
        contractPrivateStateId,
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new ContractController(contractPrivateStateId, deployedContract, providers, logger);
  }

  static async join(
    contractPrivateStateId: typeof CounterPrivateStateId,   
    providers: CounterProviders,
    contractAddress: ContractAddress,
    logger: Logger,
  ): Promise<ContractController> {
    logger.info({
      joinContract: {
        action: "Joining contract",
        contractPrivateStateId,
        contractAddress,
      },
    });

    const deployedContract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: counterCompiledContract,
      privateStateId: contractPrivateStateId,
      initialPrivateState: await ContractController.getPrivateState(contractPrivateStateId, providers.privateStateProvider),
    });

    logger.trace({
      contractJoined: {
        action: "Join the contract successfully",
        contractPrivateStateId,
        finalizedDeployTxData: deployedContract.deployTxData.public,
      },
    });

    return new ContractController(contractPrivateStateId, deployedContract, providers, logger);
  }

  private static async getPrivateState(
    counterPrivateStateId: typeof CounterPrivateStateId,
    privateStateProvider: PrivateStateProvider<typeof CounterPrivateStateId, CounterPrivateState>,
  ): Promise<CounterPrivateState> {
    const existingPrivateState = await privateStateProvider.get(counterPrivateStateId);
    const initialState = await this.getOrCreateInitialPrivateState(counterPrivateStateId, privateStateProvider);
    return existingPrivateState ?? initialState;
  }

  static async getOrCreateInitialPrivateState(
    counterPrivateStateId: typeof CounterPrivateStateId,
    privateStateProvider: PrivateStateProvider<typeof CounterPrivateStateId, CounterPrivateState>,
  ): Promise<CounterPrivateState> {
    let state = await privateStateProvider.get(counterPrivateStateId);
    
    if (state === null) {
      state = this.createPrivateState(0);
      await privateStateProvider.set(counterPrivateStateId, state);
    }
    return state;
  }

  private static createPrivateState(value: number): CounterPrivateState {    
    return createPrivateState(value);
  }
}
