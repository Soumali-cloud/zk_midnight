import { Loading } from "@/components/loading";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { useContractSubscription } from "@/modules/midnight/counter-sdk/hooks/use-contract-subscription";

export const Counter = () => {
  const { deployedContractAPI, derivedState, onDeploy, providers } =
    useContractSubscription();
  const [deployedAddress, setDeployedAddress] = useState<string | undefined>(
    undefined
  );
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    if (derivedState) {
      setAppLoading(false);
    }
  }, [derivedState]);

  const deployNew = async () => {
    const { address } = await onDeploy();
    setDeployedAddress(address);
  };

  const submitCompliance = async () => {
    if (deployedContractAPI) {
      await deployedContractAPI.submitCompliance();
    }
  };

  const revokeCompliance = async () => {
    if (deployedContractAPI) {
      await deployedContractAPI.revokeCompliance();
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      {appLoading && <Loading />}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold text-foreground mb-2">Fleet Compliance Contract</h1>
            <p className="text-xl text-muted-foreground">Call contract circuits from confidential.compact</p>
          </div>
          <div className="hidden md:block">
            <ModeToggle />
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Compliance Controller</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Deploy and call submit/revoke compliance circuits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={deployNew} className="gap-2">
                  <PlusCircle className="w-5 h-5" />
                  <span>Deploy New Contract</span>
                </Button>
              </div>

              {deployedAddress && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Deployed Contract</p>
                  <p className="text-sm font-mono break-all">{deployedAddress}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Counter Value</p>
                    <p className="text-2xl font-bold">{derivedState?.round || '0'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Fleet Compliance</p>
                    <p className="text-2xl font-bold">{derivedState?.fleetCompliance ? "true" : "false"}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Submit Action</p>
                    <p className="text-sm font-mono break-all">{derivedState?.turns.submitCompliance || 'idle'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Revoke Action</p>
                    <p className="text-sm font-mono break-all">{derivedState?.turns.revokeCompliance || 'idle'}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-6">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Contract Address</p>
                  <p className="text-sm font-mono break-all">{deployedContractAPI?.deployedContractAddress || 'Not deployed'}</p>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                <Button
                  onClick={submitCompliance}
                  disabled={!deployedContractAPI}
                  variant={deployedContractAPI ? "default" : "secondary"}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Submit Compliance</span>
                </Button>
                <Button
                  onClick={revokeCompliance}
                  disabled={!deployedContractAPI}
                  variant={deployedContractAPI ? "destructive" : "secondary"}
                  className="gap-2"
                >
                  <ShieldAlert className="w-5 h-5" />
                  <span>Revoke Compliance</span>
                </Button>
              </div>

              {providers?.flowMessage && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{providers.flowMessage}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
