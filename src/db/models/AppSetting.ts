import { Schema, model, Document } from 'mongoose';

/**
 * Configuração persistida da aplicação (par chave-valor).
 */
export interface IAppSetting extends Document {
  key: string;
  value: string;
  updatedAt: Date;
}

const appSettingSchema = new Schema<IAppSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

/** Model Mongoose para collection app_settings. */
export const AppSetting = model<IAppSetting>('AppSetting', appSettingSchema);
