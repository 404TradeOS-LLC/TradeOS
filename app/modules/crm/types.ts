export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  billingAddress?: string;
  notes?: string;
}

export interface UpdateCustomerInput extends Partial<CreateCustomerInput> {}

export interface ServiceAddressInput {
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isPrimary?: boolean;
}

export interface CustomerEquipmentInput {
  serviceAddressId?: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installedAt?: string;
  status?: string;
  notes?: string;
}

export interface NoteInput {
  entityType: "customer" | "job";
  entityId: string;
  body: string;
}

export interface CustomerImportResult {
  successCount: number;
  duplicateCount: number;
  malformedRows: Array<{
    rowNumber: number;
    message: string;
  }>;
}

export interface ServiceAgreementInput {
  serviceAddressId?: string;
  projectId?: string;
  name: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  billingCadence?: string;
  amount?: number;
  terms?: string;
}

export interface PaymentInput {
  amount: number;
  paymentDate: string;
  method: string;
  status?: string;
  reference?: string;
  notes?: string;
}

export interface CompanyProfileInput {
  companyName: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}
