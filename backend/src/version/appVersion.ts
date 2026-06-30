import packageJson from '../../package.json';

/**
 * Versão semver da API, sincronizada com `backend/package.json`.
 */
export const API_VERSION: string = packageJson.version;
