import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({ routeTree });

// Functions discovered from confidential.compact
export const COMPACT_FUNCTIONS = ['submitCompliance', 'revokeCompliance'] as const;
export type CompactFunctionName = (typeof COMPACT_FUNCTIONS)[number];

type CompactCallMap = Record<CompactFunctionName, () => Promise<unknown>>;

export interface CompactContractLike {
  callTx?: CompactCallMap;
  calltxn?: CompactCallMap;
}

const getTxMap = (contract: CompactContractLike): CompactCallMap => {
  const tx = contract.callTx ?? contract.calltxn;
  if (!tx) {
    throw new Error('Contract does not expose callTx/calltxn methods');
  }
  return tx;
};

export const callCompactFunction = async (
  contract: CompactContractLike,
  fn: CompactFunctionName,
): Promise<void> => {
  const tx = getTxMap(contract);
  await tx[fn]();
};

export const submitComplianceTx = async (contract: CompactContractLike): Promise<void> => {
  const tx = getTxMap(contract);
  await tx.submitCompliance();
};

export const revokeComplianceTx = async (contract: CompactContractLike): Promise<void> => {
  const tx = getTxMap(contract);
  await tx.revokeCompliance();
};

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
