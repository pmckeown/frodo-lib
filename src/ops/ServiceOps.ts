import { AmServiceSkeleton } from '../api/ApiTypes';
import {
  deleteService,
  deleteServiceNextDescendent,
  getService,
  getListOfServices as _getListOfServices,
  getServiceDescendents,
  putService,
  putServiceNextDescendent,
  ServiceNextDescendent,
} from '../api/ServiceApi';
import State from '../shared/State';
import { ServiceExportInterface } from './OpsTypes';
import { debugMessage, printMessage } from './utils/Console';

export default class ServiceOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  createServiceExportTemplate(): ServiceExportInterface {
    return createServiceExportTemplate();
  }

  /**
   * Get list of services
   * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
   */
  async getListOfServices(globalConfig = false) {
    return getListOfServices({ globalConfig, state: this.state });
  }

  /**
   * Get all services including their descendents.
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns Promise resolving to an array of services with their descendants
   */
  async getFullServices(globalConfig = false): Promise<FullService[]> {
    return getFullServices({ globalConfig, state: this.state });
  }

  /**
   * Deletes the specified service
   * @param {string} serviceId The service to delete
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  async deleteFullService(serviceId: string, globalConfig = false) {
    return deleteFullService({ serviceId, globalConfig, state: this.state });
  }

  /**
   * Deletes all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  async deleteFullServices(globalConfig = false) {
    return deleteFullServices({ globalConfig, state: this.state });
  }

  /**
   * Export service. The response can be saved to file as is.
   * @param serviceId service id/name
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
   */
  async exportService(
    serviceId: string,
    globalConfig = false
  ): Promise<ServiceExportInterface> {
    return exportService({ serviceId, globalConfig, state: this.state });
  }

  /**
   * Export all services
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  async exportServices(globalConfig = false): Promise<ServiceExportInterface> {
    return exportServices({ globalConfig, state: this.state });
  }

  /**
   * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
   * @param {string} serviceId The service id/name to add
   * @param {ServiceExportInterface} importData The service configuration export data to import
   * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   * @returns Promise resolving when the service has been imported
   */
  async importService(
    serviceId: string,
    importData: ServiceExportInterface,
    clean: boolean,
    globalConfig = false
  ): Promise<AmServiceSkeleton> {
    return importService({
      serviceId,
      importData,
      clean,
      globalConfig,
      state: this.state,
    });
  }

  /**
   * Imports multiple services from the same file. Optionally clean (remove) existing services first
   * @param {ServiceExportInterface} importData The service configuration export data to import
   * @param {boolean} clean Indicates whether to remove possible existing services first
   * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
   */
  async importServices(
    importData: ServiceExportInterface,
    clean: boolean,
    globalConfig = false
  ) {
    return importServices({
      importData,
      clean,
      globalConfig,
      state: this.state,
    });
  }
}

interface FullService extends AmServiceSkeleton {
  nextDescendents?: ServiceNextDescendent[];
}

/**
 * Create an empty service export template
 * @returns {SingleTreeExportInterface} an empty service export template
 */
export function createServiceExportTemplate(): ServiceExportInterface {
  return {
    meta: {},
    service: {},
  } as ServiceExportInterface;
}

/**
 * Get list of services
 * @param {boolean} globalConfig true if the list of global services is requested, false otherwise. Default: false.
 */
export async function getListOfServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}) {
  debugMessage(`ServiceOps.getListOfServices: start`);
  const services = (await _getListOfServices({ globalConfig, state })).result;
  debugMessage(`ServiceOps.getListOfServices: end`);
  return services;
}

/**
 * Get all services including their descendents.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns Promise resolving to an array of services with their descendants
 */
export async function getFullServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<FullService[]> {
  debugMessage(
    `ServiceOps.getFullServices: start, globalConfig=${globalConfig}`
  );
  const serviceList = (await _getListOfServices({ globalConfig, state }))
    .result;

  const fullServiceData = await Promise.all(
    serviceList.map(async (listItem) => {
      try {
        const [service, nextDescendents] = await Promise.all([
          getService({ serviceId: listItem._id, globalConfig, state }),
          getServiceDescendents({
            serviceId: listItem._id,
            globalConfig,
            state,
          }),
        ]);

        return {
          ...service,
          nextDescendents,
        };
      } catch (error) {
        if (
          !(
            error.response?.status === 403 &&
            error.response?.data?.message ===
              'This operation is not available in ForgeRock Identity Cloud.'
          )
        ) {
          const message = error.response?.data?.message;
          printMessage(
            `Unable to retrieve data for ${listItem._id} with error: ${message}`,
            'error'
          );
        }
      }
    })
  );

  debugMessage(`ServiceOps.getFullServices: end`);
  return fullServiceData.filter((data) => !!data); // make sure to filter out any undefined objects
}

/**
 * Saves a service using the provide id and data, including descendents
 * @param {string} serviceId the service id / name
 * @param {string} fullServiceData service object including descendants
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns promise resolving to a service object
 */
async function putFullService({
  serviceId,
  fullServiceData,
  clean,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  fullServiceData: FullService;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  debugMessage(
    `ServiceOps.putFullService: start, serviceId=${serviceId}, globalConfig=${globalConfig}`
  );
  const nextDescendents = fullServiceData.nextDescendents;

  delete fullServiceData.nextDescendents;
  delete fullServiceData._rev;
  delete fullServiceData.enabled;

  if (clean) {
    try {
      debugMessage(`ServiceOps.putFullService: clean`);
      await deleteFullService({ serviceId, globalConfig, state });
    } catch (error) {
      if (
        !(
          error.response?.status === 404 &&
          error.response?.data?.message === 'Not Found'
        )
      ) {
        const message = error.response?.data?.message;
        printMessage(
          `Error deleting service '${serviceId}' before import: ${message}`,
          'error'
        );
      }
    }
  }

  // create service first
  const result = await putService({
    serviceId,
    serviceData: fullServiceData,
    globalConfig,
    state,
  });

  // return fast if no next descendents supplied
  if (nextDescendents.length === 0) {
    debugMessage(`ServiceOps.putFullService: end (w/o descendents)`);
    return result;
  }

  // now create next descendents
  await Promise.all(
    nextDescendents.map(async (descendent) => {
      const type = descendent._type._id;
      const descendentId = descendent._id;
      debugMessage(`ServiceOps.putFullService: descendentId=${descendentId}`);
      let result = undefined;
      try {
        result = await putServiceNextDescendent({
          serviceId,
          serviceType: type,
          serviceNextDescendentId: descendentId,
          serviceNextDescendentData: descendent,
          globalConfig,
          state,
        });
      } catch (error) {
        const message = error.response?.data?.message;
        printMessage(
          `Put descendent '${descendentId}' of service '${serviceId}': ${message}`,
          'error'
        );
      }
      return result;
    })
  );
  debugMessage(`ServiceOps.putFullService: end (w/ descendents)`);
}

/**
 * Saves multiple services using the serviceEntries which contain both id and data with descendants
 * @param {[string, FullService][]} serviceEntries The services to add
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<AmService[]>} promise resolving to an array of service objects
 */
async function putFullServices({
  serviceEntries,
  clean,
  globalConfig = false,
  state,
}: {
  serviceEntries: [string, FullService][];
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton[]> {
  debugMessage(
    `ServiceOps.putFullServices: start, globalConfig=${globalConfig}`
  );
  const results: AmServiceSkeleton[] = [];
  for (const [id, data] of serviceEntries) {
    try {
      const result = await putFullService({
        serviceId: id,
        fullServiceData: data,
        clean,
        globalConfig,
        state,
      });
      results.push(result);
      printMessage(`Imported: ${id}`, 'info');
    } catch (error) {
      const message = error.response?.data?.message;
      const detail = error.response?.data?.detail;
      printMessage(`Import service '${id}': ${message}`, 'error');
      if (detail) {
        printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
      }
    }
  }
  debugMessage(`ServiceOps.putFullServices: end`);
  return results;
}

/**
 * Deletes the specified service
 * @param {string} serviceId The service to delete
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig: boolean;
  state: State;
}) {
  debugMessage(
    `ServiceOps.deleteFullService: start, globalConfig=${globalConfig}`
  );
  const serviceNextDescendentData = await getServiceDescendents({
    serviceId,
    globalConfig,
    state,
  });

  await Promise.all(
    serviceNextDescendentData.map((nextDescendent) =>
      deleteServiceNextDescendent({
        serviceId,
        serviceType: nextDescendent._type._id,
        serviceNextDescendentId: nextDescendent._id,
        globalConfig,
        state,
      })
    )
  );

  await deleteService({ serviceId, globalConfig, state });
  debugMessage(`ServiceOps.deleteFullService: end`);
}

/**
 * Deletes all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function deleteFullServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}) {
  debugMessage(
    `ServiceOps.deleteFullServices: start, globalConfig=${globalConfig}`
  );
  try {
    const serviceList = (await _getListOfServices({ globalConfig, state }))
      .result;

    await Promise.all(
      serviceList.map(async (serviceListItem) => {
        try {
          await deleteFullService({
            serviceId: serviceListItem._id,
            globalConfig,
            state,
          });
        } catch (error) {
          if (
            !(
              error.response?.status === 403 &&
              error.response?.data?.message ===
                'This operation is not available in ForgeRock Identity Cloud.'
            )
          ) {
            const message = error.response?.data?.message;
            printMessage(
              `Delete service '${serviceListItem._id}': ${message}`,
              'error'
            );
          }
        }
      })
    );
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Delete services: ${message}`, 'error');
  }
  debugMessage(`ServiceOps.deleteFullServices: end`);
}

/**
 * Export service. The response can be saved to file as is.
 * @param serviceId service id/name
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns {Promise<ServiceExportInterface>} Promise resolving to a ServiceExportInterface object.
 */
export async function exportService({
  serviceId,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  globalConfig: boolean;
  state: State;
}): Promise<ServiceExportInterface> {
  debugMessage(`ServiceOps.exportService: start, globalConfig=${globalConfig}`);
  const exportData = createServiceExportTemplate();
  try {
    const service = await getService({ serviceId, globalConfig, state });
    service.nextDescendents = await getServiceDescendents({
      serviceId,
      globalConfig,
      state,
    });
    exportData.service[serviceId] = service;
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Export service '${serviceId}': ${message}`, 'error');
  }
  debugMessage(`ServiceOps.exportService: end`);
  return exportData;
}

/**
 * Export all services
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function exportServices({
  globalConfig = false,
  state,
}: {
  globalConfig: boolean;
  state: State;
}): Promise<ServiceExportInterface> {
  debugMessage(
    `ServiceOps.exportServices: start, globalConfig=${globalConfig}`
  );
  const exportData = createServiceExportTemplate();
  try {
    const services = await getFullServices({ globalConfig, state });
    for (const service of services) {
      exportData.service[service._type._id] = service;
    }
  } catch (error) {
    const message = error.response?.data?.message;
    printMessage(`Export servics: ${message}`, 'error');
  }
  debugMessage(`ServiceOps.exportServices: end`);
  return exportData;
}

/**
 * Imports a single service using a reference to the service and a file to read the data from. Optionally clean (remove) an existing service first
 * @param {string} serviceId The service id/name to add
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {boolean} clean Indicates whether to remove a possible existing service with the same id first.
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 * @returns Promise resolving when the service has been imported
 */
export async function importService({
  serviceId,
  importData,
  clean,
  globalConfig = false,
  state,
}: {
  serviceId: string;
  importData: ServiceExportInterface;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}): Promise<AmServiceSkeleton> {
  debugMessage(`ServiceOps.importService: start, globalConfig=${globalConfig}`);
  const serviceData = importData.service[serviceId];
  const result = await putFullService({
    serviceId,
    fullServiceData: serviceData,
    clean,
    globalConfig,
    state,
  });
  debugMessage(`ServiceOps.importService: end`);
  return result;
}

/**
 * Imports multiple services from the same file. Optionally clean (remove) existing services first
 * @param {ServiceExportInterface} importData The service configuration export data to import
 * @param {boolean} clean Indicates whether to remove possible existing services first
 * @param {boolean} globalConfig true if the global service is the target of the operation, false otherwise. Default: false.
 */
export async function importServices({
  importData,
  clean,
  globalConfig = false,
  state,
}: {
  importData: ServiceExportInterface;
  clean: boolean;
  globalConfig: boolean;
  state: State;
}) {
  debugMessage(
    `ServiceOps.importServices: start, globalConfig=${globalConfig}`
  );
  try {
    const result = await putFullServices({
      serviceEntries: Object.entries(importData.service),
      clean,
      globalConfig,
      state,
    });
    debugMessage(`ServiceOps.importServices: end`);
    return result;
  } catch (error) {
    const message = error.response?.data?.message;
    const detail = error.response?.data?.detail;
    printMessage(`Unable to import services: error: ${message}`, 'error');
    if (detail) {
      printMessage(`Details: ${JSON.stringify(detail)}`, 'error');
    }
    throw error;
  }
}
