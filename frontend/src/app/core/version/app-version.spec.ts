import packageJson from '../../../../package.json';
import { APP_VERSION } from './app-version';

describe('app-version', () => {
  it('espelha a versão do package.json do frontend', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
