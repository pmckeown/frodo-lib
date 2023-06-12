import fs from 'fs';
import os from 'os';
import path from 'path';
import DataProtection from './utils/DataProtection';
import { debugMessage, printMessage, verboseMessage } from './utils/Console';
import { FRODO_CONNECTION_PROFILES_PATH_KEY } from '../storage/StaticStorage';
import { createJwkRsa, createJwks, getJwkRsaPublic, JwkRsa } from './JoseOps';
import {
  createServiceAccount,
  getServiceAccount,
} from './cloud/ServiceAccountOps';
import { IdObjectSkeletonInterface } from '../api/ApiTypes';
import { saveJsonToFile } from './utils/ExportImportUtils';
import { isValidUrl } from './utils/OpsUtils';
import State from '../shared/State';

export default class ConnectionProfileOps {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  /**
   * Get connection profiles file name
   * @returns {string} connection profiles file name
   */
  getConnectionProfilesPath(): string {
    return getConnectionProfilesPath({ state: this.state });
  }

  /**
   * Find connection profiles
   * @param {ConnectionsFileInterface} connectionProfiles connection profile object
   * @param {string} host host url or unique substring
   * @returns {SecureConnectionProfileInterface[]} Array of connection profiles
   */
  findConnectionProfiles(
    connectionProfiles: ConnectionsFileInterface,
    host: string
  ): SecureConnectionProfileInterface[] {
    return findConnectionProfiles({ connectionProfiles, host });
  }

  /**
   * Initialize connection profiles
   *
   * This method is called from app.ts and runs before any of the message handlers are registered.
   * Therefore none of the Console message functions will produce any output.
   */
  async initConnectionProfiles() {
    initConnectionProfiles({ state: this.state });
  }

  /**
   * Get connection profile by host
   * @param {String} host host tenant host url or unique substring
   * @returns {Object} connection profile or null
   */
  async getConnectionProfileByHost(
    host: string
  ): Promise<ConnectionProfileInterface> {
    return getConnectionProfileByHost({ host, state: this.state });
  }

  /**
   * Get connection profile
   * @returns {Object} connection profile or null
   */
  async getConnectionProfile(): Promise<ConnectionProfileInterface> {
    return getConnectionProfile({ state: this.state });
  }

  /**
   * Save connection profile
   * @param {string} host host url for new profiles or unique substring for existing profiles
   * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
   */
  async saveConnectionProfile(host: string): Promise<boolean> {
    return saveConnectionProfile({ host, state: this.state });
  }

  /**
   * Delete connection profile
   * @param {string} host host tenant host url or unique substring
   */
  deleteConnectionProfile(host: string): void {
    deleteConnectionProfile({ host, state: this.state });
  }

  /**
   * Create a new service account using auto-generated parameters
   * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
   */
  async addNewServiceAccount(): Promise<IdObjectSkeletonInterface> {
    return addNewServiceAccount({ state: this.state });
  }
}

const fileOptions = {
  indentation: 4,
};

export interface SecureConnectionProfileInterface {
  tenant: string;
  username?: string | null;
  encodedPassword?: string | null;
  logApiKey?: string | null;
  encodedLogApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  svcacctId?: string | null;
  encodedSvcacctJwk?: string | null;
  svcacctName?: string | null;
}

export interface ConnectionProfileInterface {
  tenant: string;
  username?: string | null;
  password?: string | null;
  logApiKey?: string | null;
  logApiSecret?: string | null;
  authenticationService?: string | null;
  authenticationHeaderOverrides?: Record<string, string>;
  svcacctId?: string | null;
  svcacctJwk?: JwkRsa;
  svcacctName?: string | null;
}

export interface ConnectionsFileInterface {
  [key: string]: SecureConnectionProfileInterface;
}

const legacyProfileFilename = '.frodorc';
const newProfileFilename = 'Connections.json';

/**
 * Get connection profiles file name
 * @param {State} state library state
 * @returns {String} connection profiles file name
 */
export function getConnectionProfilesPath({ state }: { state: State }): string {
  return (
    state.getConnectionProfilesPath() ||
    process.env[FRODO_CONNECTION_PROFILES_PATH_KEY] ||
    `${os.homedir()}/.frodo/${newProfileFilename}`
  );
}

/**
 * Find connection profiles
 * @param {ConnectionsFileInterface} connectionProfiles connection profile object
 * @param {string} host host url or unique substring
 * @param {State} state library state
 * @returns {SecureConnectionProfileInterface[]} Array of connection profiles
 */
function findConnectionProfiles({
  connectionProfiles,
  host,
}: {
  connectionProfiles: ConnectionsFileInterface;
  host: string;
}): SecureConnectionProfileInterface[] {
  const profiles: SecureConnectionProfileInterface[] = [];
  for (const tenant in connectionProfiles) {
    debugMessage(
      `ConnectionProfileOps.findConnectionProfiles: tenant=${tenant}`
    );
    if (tenant.includes(host)) {
      debugMessage(
        `ConnectionProfileOps.findConnectionProfiles: '${host}' identifies '${tenant}', including in result set`
      );
      const foundProfile = { ...connectionProfiles[tenant] };
      foundProfile.tenant = tenant;
      profiles.push(foundProfile);
    }
  }
  return profiles;
}

/**
 * Migrate from .frodorc to Connections.json
 */
function migrateFromLegacyProfile() {
  const legacyPath = `${os.homedir()}/.frodo/${legacyProfileFilename}`;
  const newPath = `${os.homedir()}/.frodo/${newProfileFilename}`;
  if (!fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
    // no connections file (old or new), create empty new one
    fs.writeFileSync(
      newPath,
      JSON.stringify({}, null, fileOptions.indentation)
    );
  } else if (fs.existsSync(legacyPath) && !fs.existsSync(newPath)) {
    // old exists, new one does not - so copy old to new one
    fs.copyFileSync(legacyPath, newPath);
    // for now, just add a "deprecated" suffix. May delete the old file
    // in a future release
    fs.renameSync(legacyPath, `${legacyPath}.deprecated`);
  }
  // in other cases, where
  // (both old and new exist) OR (only new one exists) don't do anything
}

/**
 * Initialize connection profiles
 *
 * This method is called from app.ts and runs before any of the message handlers are registered.
 * Therefore none of the Console message functions will produce any output.
 * @param {State} state library state
 */
export async function initConnectionProfiles({ state }: { state: State }) {
  const dataProtection = new DataProtection(state.getMasterKeyPath());
  // create connections.json file if it doesn't exist
  const filename = getConnectionProfilesPath({ state });
  const folderName = path.dirname(filename);
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName, { recursive: true });
    if (!fs.existsSync(filename)) {
      fs.writeFileSync(
        filename,
        JSON.stringify({}, null, fileOptions.indentation)
      );
    }
  }
  // encrypt the password and logApiSecret from clear text to aes-256-GCM
  else {
    migrateFromLegacyProfile();
    const data = fs.readFileSync(filename, 'utf8');
    const connectionsData: ConnectionsFileInterface = JSON.parse(data);
    let convert = false;
    for (const conn of Object.keys(connectionsData)) {
      if (connectionsData[conn]['password']) {
        convert = true;
        connectionsData[conn].encodedPassword = await dataProtection.encrypt(
          connectionsData[conn]['password']
        );
        delete connectionsData[conn]['password'];
      }
      if (connectionsData[conn]['logApiSecret']) {
        convert = true;
        connectionsData[conn].encodedLogApiSecret =
          await dataProtection.encrypt(connectionsData[conn]['logApiSecret']);
        delete connectionsData[conn]['logApiSecret'];
      }
      if (connectionsData[conn]['svcacctJwk']) {
        convert = true;
        connectionsData[conn].encodedSvcacctJwk = await dataProtection.encrypt(
          connectionsData[conn]['svcacctJwk']
        );
        delete connectionsData[conn]['svcacctJwk'];
      }
    }
    if (convert) {
      fs.writeFileSync(
        filename,
        JSON.stringify(connectionsData, null, fileOptions.indentation)
      );
    }
  }
}

/**
 * Get connection profile by host
 * @param {String} host host tenant host url or unique substring
 * @param {State} state library state
 * @returns {Object} connection profile or null
 */
export async function getConnectionProfileByHost({
  host,
  state,
}: {
  host: string;
  state: State;
}): Promise<ConnectionProfileInterface> {
  try {
    const dataProtection = new DataProtection(state.getMasterKeyPath());
    const filename = getConnectionProfilesPath({ state });
    const connectionsData = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const profiles = findConnectionProfiles({
      connectionProfiles: connectionsData,
      host,
    });
    if (profiles.length == 0) {
      printMessage(
        `Profile for ${host} not found. Please specify credentials on command line`,
        'error'
      );
      return null;
    }
    if (profiles.length > 1) {
      printMessage(`Multiple matching profiles found.`, 'error');
      profiles.forEach((p) => {
        printMessage(`- ${p.tenant}`, 'error');
      });
      printMessage(`Please specify a unique sub-string`, 'error');
      return null;
    }
    return {
      tenant: profiles[0].tenant,
      username: profiles[0].username ? profiles[0].username : null,
      password: profiles[0].encodedPassword
        ? await dataProtection.decrypt(profiles[0].encodedPassword)
        : null,
      logApiKey: profiles[0].logApiKey ? profiles[0].logApiKey : null,
      logApiSecret: profiles[0].encodedLogApiSecret
        ? await dataProtection.decrypt(profiles[0].encodedLogApiSecret)
        : null,
      authenticationService: profiles[0].authenticationService
        ? profiles[0].authenticationService
        : null,
      authenticationHeaderOverrides: profiles[0].authenticationHeaderOverrides
        ? profiles[0].authenticationHeaderOverrides
        : {},
      svcacctName: profiles[0].svcacctName ? profiles[0].svcacctName : null,
      svcacctId: profiles[0].svcacctId ? profiles[0].svcacctId : null,
      svcacctJwk: profiles[0].encodedSvcacctJwk
        ? await dataProtection.decrypt(profiles[0].encodedSvcacctJwk)
        : null,
    };
  } catch (e) {
    printMessage(
      `Can not read saved connection info, please specify credentials on command line: ${e}`,
      'error'
    );
    return null;
  }
}

/**
 * Get connection profile
 * @returns {Object} connection profile or null
 */
export async function getConnectionProfile({
  state,
}: {
  state: State;
}): Promise<ConnectionProfileInterface> {
  return getConnectionProfileByHost({ host: state.getHost(), state });
}

/**
 * Save connection profile
 * @param {string} host host url for new profiles or unique substring for existing profiles
 * @returns {Promise<boolean>} true if the operation succeeded, false otherwise
 */
export async function saveConnectionProfile({
  host,
  state,
}: {
  host: string;
  state: State;
}): Promise<boolean> {
  debugMessage(`ConnectionProfileOps.saveConnectionProfile: start`);
  const dataProtection = new DataProtection(state.getMasterKeyPath());
  const filename = getConnectionProfilesPath({ state });
  debugMessage(`Saving connection profile in ${filename}`);
  let profiles: ConnectionsFileInterface = {};
  let profile: SecureConnectionProfileInterface = { tenant: '' };
  try {
    fs.statSync(filename);
    const data = fs.readFileSync(filename, 'utf8');
    profiles = JSON.parse(data);

    // find tenant
    const found = findConnectionProfiles({
      connectionProfiles: profiles,
      host,
    });

    // replace tenant in session with real tenant url if necessary
    if (found.length === 1) {
      profile = found[0];
      state.setHost(profile.tenant);
      verboseMessage(`Existing profile: ${profile.tenant}`);
      debugMessage(profile);
    }

    // connection profile not found, validate host is a real URL
    if (found.length === 0) {
      if (isValidUrl(host)) {
        state.setHost(host);
        debugMessage(`New profile: ${host}`);
      } else {
        printMessage(
          `No existing profile found matching '${host}'. Provide a valid URL as the host argument to create a new profile.`,
          'error'
        );
        debugMessage(`ConnectionProfileOps.saveConnectionProfile: end [false]`);
        return false;
      }
    }
  } catch (error) {
    debugMessage(`New profiles file ${filename} with new profile ${host}`);
  }

  // user account
  if (state.getUsername()) profile.username = state.getUsername();
  if (state.getPassword())
    profile.encodedPassword = await dataProtection.encrypt(state.getPassword());

  // log API
  if (state.getLogApiKey()) profile.logApiKey = state.getLogApiKey();
  if (state.getLogApiSecret())
    profile.encodedLogApiSecret = await dataProtection.encrypt(
      state.getLogApiSecret()
    );

  // service account
  if (state.getServiceAccountId()) {
    profile.svcacctId = state.getServiceAccountId();
    profile.svcacctName = (
      await getServiceAccount({
        serviceAccountId: state.getServiceAccountId(),
        state,
      })
    ).name;
  }
  if (state.getServiceAccountJwk())
    profile.encodedSvcacctJwk = await dataProtection.encrypt(
      state.getServiceAccountJwk()
    );
  // update existing service account profile
  if (profile.svcacctId && !profile.svcacctName) {
    profile.svcacctName = (
      await getServiceAccount({ serviceAccountId: profile.svcacctId, state })
    ).name;
    debugMessage(
      `ConnectionProfileOps.saveConnectionProfile: added missing service account name`
    );
  }

  // advanced settings
  if (state.getAuthenticationService()) {
    profile.authenticationService = state.getAuthenticationService();
    printMessage(
      'Advanced setting: Authentication Service: ' +
        state.getAuthenticationService(),
      'info'
    );
  }
  if (
    state.getAuthenticationHeaderOverrides() &&
    Object.entries(state.getAuthenticationHeaderOverrides()).length
  ) {
    profile.authenticationHeaderOverrides =
      state.getAuthenticationHeaderOverrides();
    printMessage('Advanced setting: Authentication Header Overrides: ', 'info');
    printMessage(state.getAuthenticationHeaderOverrides(), 'info');
  }

  // remove the helper key 'tenant'
  delete profile.tenant;

  // update profiles
  profiles[state.getHost()] = profile;

  // sort profiles
  const orderedProfiles = Object.keys(profiles)
    .sort()
    .reduce((obj, key) => {
      obj[key] = profiles[key];
      return obj;
    }, {});

  // save profiles
  saveJsonToFile({
    data: orderedProfiles,
    filename,
    includeMeta: false,
    state,
  });
  verboseMessage(`Saved connection profile ${state.getHost()} in ${filename}`);
  debugMessage(`ConnectionProfileOps.saveConnectionProfile: end [true]`);
  return true;
}

/**
 * Delete connection profile
 * @param {String} host host tenant host url or unique substring
 */
export function deleteConnectionProfile({
  host,
  state,
}: {
  host: string;
  state: State;
}) {
  const filename = getConnectionProfilesPath({ state });
  let connectionsData: ConnectionsFileInterface = {};
  fs.stat(filename, (err) => {
    if (err == null) {
      const data = fs.readFileSync(filename, 'utf8');
      connectionsData = JSON.parse(data);
      const profiles = findConnectionProfiles({
        connectionProfiles: connectionsData,
        host,
      });
      if (profiles.length == 1) {
        delete connectionsData[profiles[0].tenant];
        fs.writeFileSync(filename, JSON.stringify(connectionsData, null, 2));
        printMessage(`Deleted connection profile ${profiles[0].tenant}`);
      } else {
        if (profiles.length > 1) {
          printMessage(`Multiple matching profiles found.`, 'error');
          profiles.forEach((p) => {
            printMessage(`- ${p.tenant}`, 'error');
          });
          printMessage(`Please specify a unique sub-string`, 'error');
          return null;
        } else {
          printMessage(`No connection profile ${host} found`);
        }
      }
    } else if (err.code === 'ENOENT') {
      printMessage(`Connection profile file ${filename} not found`);
    } else {
      printMessage(
        `Error in deleting connection profile: ${err.code}`,
        'error'
      );
    }
  });
}

/**
 * Create a new service account using auto-generated parameters
 * @returns {Promise<IdObjectSkeletonInterface>} A promise resolving to a service account object
 */
export async function addNewServiceAccount({
  state,
}: {
  state: State;
}): Promise<IdObjectSkeletonInterface> {
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: start`);
  const name = `Frodo-SA-${new Date().getTime()}`;
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: name=${name}...`);
  const description = `${state.getUsername()}'s Frodo Service Account`;
  const scope = ['fr:am:*', 'fr:idm:*', 'fr:idc:esv:*'];
  const jwkPrivate = await createJwkRsa();
  const jwkPublic = await getJwkRsaPublic(jwkPrivate);
  const jwks = createJwks(jwkPublic);
  const sa = await createServiceAccount({
    name,
    description,
    accountStatus: 'Active',
    scopes: scope,
    jwks,
    state,
  });
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: id=${sa._id}`);
  state.setServiceAccountId(sa._id);
  state.setServiceAccountJwk(jwkPrivate);
  debugMessage(`ConnectionProfileOps.addNewServiceAccount: end`);
  return sa;
}
