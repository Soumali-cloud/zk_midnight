import { type CounterPrivateState, Counter, createPrivateState } from '@eddalabs/counter-contract';
import type { ImpureCircuitId } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import type { DeployedContract, FoundContract } from '@midnight-ntwrk/midnight-js-contracts';

export type CounterCircuits = ImpureCircuitId<Counter.Contract<CounterPrivateState>>;

export const CounterPrivateStateId = 'counterPrivateState';

export type CounterProviders = MidnightProviders<CounterCircuits, typeof CounterPrivateStateId, CounterPrivateState>;

export type CounterContract = Counter.Contract<CounterPrivateState>;

export type DeployedCounterContract = DeployedContract<CounterContract> | FoundContract<CounterContract>;

export type UserAction = {
  submitCompliance: string | undefined;
  revokeCompliance: string | undefined;
};

export type DerivedState = {
  readonly round: Counter.Ledger["round"];
  readonly fleetCompliance: boolean;
  readonly privateState: CounterPrivateState;
  readonly turns: UserAction;
};

export const emptyState: DerivedState = {
  round: 0n,
  fleetCompliance: false,
  privateState: createPrivateState(0),
  turns: { submitCompliance: undefined, revokeCompliance: undefined },
};
