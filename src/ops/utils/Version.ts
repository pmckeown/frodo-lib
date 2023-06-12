import fs from 'fs';
import path from 'path';
import { generateReleaseApi } from '../../api/BaseApi';

import { fileURLToPath } from 'url';
import State from '../../shared/State';

export default class Version {
  state: State;
  constructor(state: State) {
    this.state = state;
  }

  getVersion() {
    return getVersion({ state: this.state });
  }

  async getAllVersions(endpoints: { base: string; path: string }[]) {
    return getAllVersions({ endpoints, state: this.state });
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8')
);

export function getVersion({ state }: { state: State }) {
  // must initialize state to avoid library initialization issues
  if (state) return `${pkg.version}`;
}

export async function getAllVersions({
  endpoints,
  state,
}: {
  endpoints: { base: string; path: string }[];
  state: State;
}) {
  const reqPromises = [];
  endpoints.forEach((item) => {
    reqPromises.push(
      generateReleaseApi({ baseUrl: item.base, state }).get(item.path)
    );
  });
  const result = await Promise.allSettled(reqPromises);
  return result;
}
