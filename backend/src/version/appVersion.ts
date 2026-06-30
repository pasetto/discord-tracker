import packageJson from '../../package.json';
import buildInfo from './build-info.json';

/**
 * Metadados do build da API gerados em `npm run build`.
 */
export interface ApiBuildInfo {
  /** Versão semver do pacote no momento do build. */
  version: string;
  /** Versão exposta no badge (semver do build em execução). */
  buildVersion: string;
  /** SHA curto do commit Git usado no build. */
  gitSha: string;
  /** ISO timestamp de quando o build foi gerado. */
  builtAt: string;
}

/** Snapshot do último build da API (atualizado pelo script de build). */
export const API_BUILD_INFO: ApiBuildInfo = buildInfo;

/**
 * Versão semver da API, sincronizada com `backend/package.json`.
 */
export const API_VERSION: string = packageJson.version;

/**
 * Versão semver do build da API em execução (carimbada no deploy).
 */
export const API_BUILD_VERSION: string = buildInfo.buildVersion || packageJson.version;
