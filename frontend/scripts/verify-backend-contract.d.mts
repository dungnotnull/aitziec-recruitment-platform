export type BackendContractRequirement = {
  method: string
  path: string
  consumer: string
}

export type BackendContractComparison = {
  missing: string[]
  present: string[]
}

export function compareBackendContract(
  openApi: { paths?: Record<string, Record<string, unknown>> },
  requirements: BackendContractRequirement[],
): BackendContractComparison
