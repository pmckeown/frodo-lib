import _ from 'lodash';
import {
  Saml2ProiderLocation,
  Saml2ProviderSkeleton,
  Saml2ProviderStub,
} from '../api/ApiTypes';
import {
  createProvider,
  updateProvider,
  deleteRawProvider,
  findProviders,
  getProviderByLocationAndId as _getProviderByLocationAndId,
  getProviderMetadata as _getProviderMetadata,
  getProviderMetadataUrl as _getProviderMetadataUrl,
  getRawProvider,
  getProviders,
  getRawProviders,
  putRawProvider,
  deleteProviderByLocationAndId,
} from '../api/Saml2Api';
import { getScript } from '../api/ScriptApi';
import {
  decode,
  decodeBase64Url,
  encode,
  encodeBase64Url,
} from '../api/utils/Base64';
import { MultiOpStatusInterface, Saml2ExportInterface } from './OpsTypes';
import { putScript } from './ScriptOps';
import { debugMessage, printMessage } from './utils/Console';
import {
  convertBase64TextToArray,
  convertBase64UrlTextToArray,
  convertTextArrayToBase64,
  convertTextArrayToBase64Url,
  getMetadata,
} from './utils/ExportImportUtils';
import State from '../shared/State';

export default class Saml2Ops {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get SAML2 entity provider stubs
   * @returns {Promise<Saml2ProviderStub[]>} a promise that resolves to an array of saml2 entity stubs
   */
  async getSaml2ProviderStubs(): Promise<Saml2ProviderStub[]> {
    return getSaml2ProviderStubs({ state: this.state });
  }

  /**
   * Geta SAML2 entity provider by location and id
   * @param {string} location Entity provider location (hosted or remote)
   * @param {string} entityId64 Base64-encoded-without-padding provider entity id
   * @returns {Promise} a promise that resolves to a saml2 entity provider object
   */
  async getProviderByLocationAndId(location: string, entityId64: string) {
    return getProviderByLocationAndId({
      location,
      entityId64,
      state: this.state,
    });
  }

  /**
   * Get a SAML2 entity provider's metadata URL by entity id
   * @param {string} entityId SAML2 entity id
   * @returns {string} the URL to get the metadata from
   */
  getProviderMetadataUrl(entityId: string): string {
    return getProviderMetadataUrl({ entityId, state: this.state });
  }

  /**
   * Get a SAML2 entity provider's metadata by entity id
   * @param {string} entityId SAML2 entity id
   * @returns {Promise<object>} a promise that resolves to an object containing a SAML2 metadata
   */
  async getProviderMetadata(entityId: string) {
    return getProviderMetadata({ entityId, state: this.state });
  }

  /**
   *
   * @param {string} entityId Provider entity id
   * @returns {Promise<Saml2ProviderStub>} Promise resolving to a Saml2ExportInterface object.
   */
  async getSaml2ProviderStub(entityId: string): Promise<Saml2ProviderStub> {
    return getSaml2ProviderStub({ entityId, state: this.state });
  }

  /**
   * Export a single entity provider. The response can be saved to file as is.
   * @param {string} entityId Provider entity id
   * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
   */
  async getSaml2Provider(entityId: string): Promise<Saml2ProviderSkeleton> {
    return getSaml2Provider({ entityId, state: this.state });
  }

  /**
   * Delete an entity provider. The response can be saved to file as is.
   * @param {string} entityId Provider entity id
   * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
   */
  async deleteSaml2Provider(entityId: string): Promise<Saml2ProviderSkeleton> {
    return deleteSaml2Provider({ entityId, state: this.state });
  }

  /**
   * Delete all entity providers.
   * @returns {Promise<Saml2ProviderSkeleton[]>} Promise resolving to an array of Saml2ProviderSkeleton objects.
   */
  async deleteSaml2Providers(): Promise<Saml2ProviderSkeleton[]> {
    return deleteSaml2Providers({ state: this.state });
  }

  /**
   * Export a single entity provider. The response can be saved to file as is.
   * @param {string} entityId Provider entity id
   * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
   */
  async exportSaml2Provider(entityId: string): Promise<Saml2ExportInterface> {
    return exportSaml2Provider({ entityId, state: this.state });
  }

  /**
   * Export all entity providers. The response can be saved to file as is.
   * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
   */
  async exportSaml2Providers(): Promise<Saml2ExportInterface> {
    return exportSaml2Providers({ state: this.state });
  }

  /**
   * Import a SAML entity provider
   * @param {string} entityId Provider entity id
   * @param {Saml2ExportInterface} importData Import data
   */
  async importSaml2Provider(
    entityId: string,
    importData: Saml2ExportInterface
  ): Promise<boolean> {
    return importSaml2Provider({ entityId, importData, state: this.state });
  }

  /**
   * Import SAML entity providers
   * @param {Saml2ExportInterface} importData Import data
   */
  async importSaml2Providers(
    importData: Saml2ExportInterface
  ): Promise<MultiOpStatusInterface> {
    return importSaml2Providers({ importData, state: this.state });
  }
}

export const roleMap = {
  identityProvider: 'IDP',
  serviceProvider: 'SP',
  attributeQueryProvider: 'AttrQuery',
  xacmlPolicyEnforcementPoint: 'XACML PEP',
};

// use a function vs a template variable to avoid problems in loops
export function createSaml2ExportTemplate({
  state,
}: {
  state: State;
}): Saml2ExportInterface {
  return {
    meta: getMetadata({ state }),
    script: {},
    saml: {
      hosted: {},
      remote: {},
      metadata: {},
    },
  } as Saml2ExportInterface;
}

/**
 * Get SAML2 entity provider stubs
 * @returns {Promise<Saml2ProviderStub[]>} a promise that resolves to an array of saml2 entity stubs
 */
export async function getSaml2ProviderStubs({
  state,
}: {
  state: State;
}): Promise<Saml2ProviderStub[]> {
  const { result } = await getProviders({ state });
  return result;
}

/**
 * Geta SAML2 entity provider by location and id
 * @param {string} location Entity provider location (hosted or remote)
 * @param {string} entityId64 Base64-encoded-without-padding provider entity id
 * @returns {Promise} a promise that resolves to a saml2 entity provider object
 */
export async function getProviderByLocationAndId({
  location,
  entityId64,
  state,
}: {
  location: string;
  entityId64: string;
  state: State;
}) {
  return _getProviderByLocationAndId({ location, entityId64, state });
}

/**
 * Get a SAML2 entity provider's metadata URL by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {string} the URL to get the metadata from
 */
export function getProviderMetadataUrl({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): string {
  return _getProviderMetadataUrl({ entityId, state });
}

/**
 * Get a SAML2 entity provider's metadata by entity id
 * @param {string} entityId SAML2 entity id
 * @returns {Promise<object>} a promise that resolves to an object containing a SAML2 metadata
 */
export async function getProviderMetadata({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}) {
  return _getProviderMetadata({ entityId, state });
}

/**
 * Include dependencies in the export file
 * @param {object} providerData Object representing a SAML entity provider
 * @param {object} fileData File data object to add dependencies to
 */
async function exportDependencies({
  providerData,
  fileData,
  state,
}: {
  providerData: Saml2ProviderSkeleton;
  fileData: Saml2ExportInterface;
  state: State;
}) {
  const attrMapperScriptId = _.get(providerData, [
    'identityProvider',
    'assertionProcessing',
    'attributeMapper',
    'attributeMapperScript',
  ]);
  if (attrMapperScriptId && attrMapperScriptId !== '[Empty]') {
    const scriptData = await getScript({ scriptId: attrMapperScriptId, state });
    scriptData.script = convertBase64TextToArray(scriptData.script);
    fileData.script[attrMapperScriptId] = scriptData;
  }
  const idpAdapterScriptId = _.get(providerData, [
    'identityProvider',
    'advanced',
    'idpAdapter',
    'idpAdapterScript',
  ]);
  if (idpAdapterScriptId && idpAdapterScriptId !== '[Empty]') {
    const scriptData = await getScript({ scriptId: idpAdapterScriptId, state });
    scriptData.script = convertBase64TextToArray(scriptData.script);
    fileData.script[idpAdapterScriptId] = scriptData;
  }
  const metaDataResponse = await getProviderMetadata({
    entityId: providerData.entityId,
    state,
  });
  if (!metaDataResponse) {
    throw new Error(
      `Unable to obtain metadata from ${getProviderMetadataUrl({
        entityId: providerData.entityId,
        state,
      })}`
    );
  }
  fileData.saml.metadata[providerData._id] = convertBase64UrlTextToArray(
    encodeBase64Url(metaDataResponse)
  );
}

/**
 *
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderStub>} Promise resolving to a Saml2ExportInterface object.
 */
export async function getSaml2ProviderStub({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<Saml2ProviderStub> {
  debugMessage(`Saml2Ops.getSaml2ProviderStub: start [entityId=${entityId}]`);
  const found = await findProviders({
    filter: `entityId eq '${entityId}'`,
    state,
  });
  switch (found.resultCount) {
    case 0:
      throw new Error(`No provider with entity id '${entityId}' found`);
    case 1: {
      debugMessage(`Saml2Ops.getSaml2ProviderStub: end [entityId=${entityId}]`);
      return found.result[0];
    }
    default:
      throw new Error(`Multiple providers with entity id '${entityId}' found`);
  }
}

/**
 * Export a single entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function getSaml2Provider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.getSaml2Provider: start [entityId=${entityId}]`);
  const stub = await getSaml2ProviderStub({ entityId, state });
  const { location } = stub;
  const id = stub._id;
  const providerData = await getProviderByLocationAndId({
    location,
    entityId64: id,
    state,
  });
  debugMessage(`Saml2Ops.getSaml2Provider: end [entityId=${entityId}]`);
  return providerData;
}

/**
 * Delete an entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function deleteSaml2Provider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.deleteSaml2Provider: start [entityId=${entityId}]`);
  const stub = await getSaml2ProviderStub({ entityId, state });
  const { location } = stub;
  const id = stub._id;
  const providerData = await deleteProviderByLocationAndId({
    location,
    entityId64: id,
    state,
  });
  debugMessage(`Saml2Ops.deleteSaml2Provider: end [entityId=${entityId}]`);
  return providerData;
}

/**
 * Delete all entity providers.
 * @returns {Promise<Saml2ProviderSkeleton[]>} Promise resolving to an array of Saml2ProviderSkeleton objects.
 */
export async function deleteSaml2Providers({
  state,
}: {
  state: State;
}): Promise<Saml2ProviderSkeleton[]> {
  debugMessage(`Saml2Ops.deleteSaml2Providers: start`);
  const providers: Saml2ProviderSkeleton[] = [];
  const stubs = await getSaml2ProviderStubs({ state });
  for (const stub of stubs) {
    const provider = await deleteProviderByLocationAndId({
      location: stub.location,
      entityId64: stub._id,
      state,
    });
    providers.push(provider);
  }
  debugMessage(
    `Saml2Ops.deleteSaml2Providers: end [deleted ${providers.length} providers]`
  );
  return providers;
}

/**
 * Export a single entity provider. The response can be saved to file as is.
 * @param {string} entityId Provider entity id
 * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
 */
export async function exportSaml2Provider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<Saml2ExportInterface> {
  debugMessage(`Saml2Ops.exportSaml2Provider: start [entityId=${entityId}]`);
  const exportData = createSaml2ExportTemplate({ state });
  const stub = await getSaml2ProviderStub({ entityId, state });
  const { location } = stub;
  const id = stub._id;
  const providerData = await getProviderByLocationAndId({
    location,
    entityId64: id,
    state,
  });
  exportData.saml[stub.location][providerData._id] = providerData;
  try {
    await exportDependencies({ providerData, fileData: exportData, state });
  } catch (error) {
    printMessage(error.message, 'error');
  }
  debugMessage(`Saml2Ops.exportSaml2Provider: end [entityId=${entityId}]`);
  return exportData;
}

/**
 * Export all entity providers. The response can be saved to file as is.
 * @returns {Promise<Saml2ExportInterface>} Promise resolving to a Saml2ExportInterface object.
 */
export async function exportSaml2Providers({
  state,
}: {
  state: State;
}): Promise<Saml2ExportInterface> {
  const fileData = createSaml2ExportTemplate({ state });
  const stubs = await getSaml2ProviderStubs({ state });
  for (const stub of stubs) {
    const providerData = await getProviderByLocationAndId({
      location: stub.location,
      entityId64: stub._id,
      state,
    });
    try {
      await exportDependencies({ providerData, fileData, state });
    } catch (error) {
      printMessage(error, 'error');
    }
    fileData.saml[stub.location][providerData._id] = providerData;
  }
  return fileData;
}

/**
 * Include dependencies from the import file
 * @param {object} providerData Object representing a SAML entity provider
 * @param {object} fileData File data object to read dependencies from
 */
async function importDependencies({
  providerData,
  fileData,
  state,
}: {
  providerData: Saml2ProviderSkeleton;
  fileData: Saml2ExportInterface;
  state: State;
}) {
  debugMessage(`Saml2Ops.importDependencies: start`);
  const attrMapperScriptId = _.get(providerData, [
    'identityProvider',
    'assertionProcessing',
    'attributeMapper',
    'attributeMapperScript',
  ]);
  if (attrMapperScriptId && attrMapperScriptId !== '[Empty]') {
    debugMessage(
      `Saml2Ops.importDependencies: attributeMapperScript=${attrMapperScriptId}`
    );
    const scriptData = _.get(fileData, ['script', attrMapperScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script as string[]);
    await putScript({ scriptId: attrMapperScriptId, scriptData, state });
  }
  const idpAdapterScriptId = _.get(providerData, [
    'identityProvider',
    'advanced',
    'idpAdapter',
    'idpAdapterScript',
  ]);
  if (idpAdapterScriptId && idpAdapterScriptId !== '[Empty]') {
    debugMessage(
      `Saml2Ops.importDependencies: idpAdapterScript=${idpAdapterScriptId}`
    );
    const scriptData = _.get(fileData, ['script', idpAdapterScriptId]);
    scriptData.script = convertTextArrayToBase64(scriptData.script as string[]);
    await putScript({ scriptId: idpAdapterScriptId, scriptData, state });
  }
  debugMessage(`Saml2Ops.importDependencies: end`);
}

/**
 * Find provider in import file and return its location
 * @param {string} entityId64 Base64-encoded provider entity id
 * @param {Saml2ExportInterface} data Import file json data
 * @returns {string} 'hosted' or 'remote' if found, undefined otherwise
 */
function getLocation(
  entityId64: string,
  data: Saml2ExportInterface
): Saml2ProiderLocation {
  if (data.saml.hosted[entityId64]) {
    return Saml2ProiderLocation.HOSTED;
  }
  if (data.saml.remote[entityId64]) {
    return Saml2ProiderLocation.REMOTE;
  }
  return undefined;
}

/**
 * Import a SAML entity provider
 * @param {string} entityId Provider entity id
 * @param {Saml2ExportInterface} importData Import data
 */
export async function importSaml2Provider({
  entityId,
  importData,
  state,
}: {
  entityId: string;
  importData: Saml2ExportInterface;
  state: State;
}): Promise<boolean> {
  debugMessage(`Saml2Ops.importSaml2Provider: start`);
  const entityId64 = encode(entityId, false);
  const location = getLocation(entityId64, importData);
  debugMessage(
    `Saml2Ops.importSaml2Provider: entityId=${entityId}, entityId64=${entityId64}, location=${location}`
  );
  if (location) {
    const providerData = importData.saml[location][entityId64];
    await importDependencies({ providerData, fileData: importData, state });
    let metaData = null;
    if (location === Saml2ProiderLocation.REMOTE) {
      metaData = convertTextArrayToBase64Url(
        importData.saml.metadata[entityId64]
      );
    }
    try {
      await createProvider({ location, providerData, metaData, state });
    } catch (error) {
      await updateProvider({ location, providerData, state });
    }
  } else {
    throw new Error(`Provider ${entityId} not found in import data!`);
  }
  debugMessage(`Saml2Ops.importSaml2Provider: end`);
  return true;
}

/**
 * Import SAML entity providers
 * @param {Saml2ExportInterface} importData Import data
 */
export async function importSaml2Providers({
  importData,
  state,
}: {
  importData: Saml2ExportInterface;
  state: State;
}): Promise<MultiOpStatusInterface> {
  debugMessage(`Saml2Ops.importSaml2Providers: start`);
  const myStatus: MultiOpStatusInterface = {
    total: 0,
    successes: 0,
    warnings: 0,
    failures: 0,
  };
  try {
    // find providers in hosted and in remote and map locations
    const hostedIds = Object.keys(importData.saml.hosted);
    const remoteIds = Object.keys(importData.saml.remote);
    const providerIds = hostedIds.concat(remoteIds);
    myStatus.total = providerIds.length;
    for (const entityId64 of providerIds) {
      debugMessage(
        `Saml2Ops.importSaml2Providers: entityId=${decodeBase64Url(entityId64)}`
      );
      const location = hostedIds.includes(entityId64)
        ? Saml2ProiderLocation.HOSTED
        : Saml2ProiderLocation.REMOTE;
      const entityId = decode(entityId64);
      const providerData = importData.saml[location][entityId64];
      try {
        await importDependencies({ providerData, fileData: importData, state });
      } catch (importDependenciesErr) {
        myStatus.warnings += 1;
        printMessage(
          `\nWarning importing dependencies for ${entityId}`,
          'warn'
        );
        printMessage(importDependenciesErr.response.data, 'error');
      }
      let metaData = null;
      if (location === Saml2ProiderLocation.REMOTE) {
        metaData = convertTextArrayToBase64Url(
          importData.saml.metadata[entityId64]
        );
      }
      try {
        await createProvider({ location, providerData, metaData, state });
        myStatus.successes += 1;
      } catch (createProviderErr) {
        try {
          await updateProvider({ location, providerData, state });
          myStatus.successes += 1;
        } catch (updateProviderError) {
          myStatus.failures += 1;
          printMessage(
            `\nError importing provider ${entityId}: ${updateProviderError.message}`,
            'error'
          );
          printMessage(updateProviderError.response?.data, 'error');
        }
      }
    }
    myStatus.message = `${myStatus.successes}/${myStatus.total} providers imported.`;
  } catch (error) {
    myStatus.failures += 1;
    printMessage(`\nError importing providers ${error.message}`, 'error');
  }
  debugMessage(`Saml2Ops.importSaml2Providers: end`);
  return myStatus;
}

// Contributions using legacy APIs. Need to investigate if those will be deprecated in the future

/**
 * Deletes entity provider
 * @param {string} entityId The entity id for the entity to be deleted
 * @returns {Promise<Saml2ProviderSkeleton>} Promise resolving to a Saml2ExportInterface object.
 */
export async function deleteRawSaml2Provider({
  entityId,
  state,
}: {
  entityId: string;
  state: State;
}): Promise<Saml2ProviderSkeleton> {
  debugMessage(`Saml2Ops.deleteSaml2Provider: start [entityId=${entityId}]`);
  const response = await deleteRawProvider({ entityId, state });
  debugMessage(`Saml2Ops.deleteSaml2Provider: end [entityId=${entityId}]`);
  return response;
}

/**
 * Deletes all entity providers.
 */
export async function deleteRawSaml2Providers({
  state,
}: {
  state: State;
}): Promise<Saml2ProviderSkeleton[]> {
  const applicationList = (await getRawProviders({ state })).result;
  const deleteApplicationPromises = [];
  applicationList.forEach((item) => {
    printMessage(`Deleting Application ${item._id}`, 'error');
    deleteApplicationPromises.push(
      deleteRawProvider({ entityId: item._id, state })
    );
  });
  const deleteApplicationResult = await Promise.all(deleteApplicationPromises);
  if (deleteApplicationResult.length == applicationList.length) {
    printMessage('SAML Entity cleanup done', 'info');
  }
  return deleteApplicationResult;
}

export {
  getRawProvider as getRawSaml2Provider,
  getRawProviders as getRawSaml2Providers,
  putRawProvider as putRawSaml2Provider,
};
