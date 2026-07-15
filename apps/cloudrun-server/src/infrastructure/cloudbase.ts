import cloudbase from "@cloudbase/node-sdk";

export function createCloudBaseApplication(envId: string) {
  return cloudbase.init({ env: envId });
}

export type CloudBaseApplication = ReturnType<
  typeof createCloudBaseApplication
>;
