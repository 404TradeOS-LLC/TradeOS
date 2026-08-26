export interface CompanyLogoStorageAdapter {
  kind: string;
  uploadLogo(_input: { fileName: string; mimeType: string; sizeBytes: number; contentBase64: string }): Promise<{ url: string }>;
}

export function getCompanyLogoStorageAdapter(): CompanyLogoStorageAdapter | null {
  return null;
}
