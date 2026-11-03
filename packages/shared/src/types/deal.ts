export enum DealStage {
  APPLICATION = 'APPLICATION',       // 1.1
  CALCULATION = 'CALCULATION',       // 1.2
  PROPOSAL = 'PROPOSAL',             // 1.3
  AWAITING_PAYMENT = 'AWAITING_PAYMENT', // 1.4
  PAID = 'PAID',                     // 2.1
  ASSEMBLY = 'ASSEMBLY',             // 2.2
  PAINTING = 'PAINTING',             // 2.3
  PREP_SHIPMENT = 'PREP_SHIPMENT',   // 2.4
  INSTALL_FIRST = 'INSTALL_FIRST',   // 3.1
  GLUING = 'GLUING',                 // 3.2
  INSTALL_SECOND = 'INSTALL_SECOND', // 3.3
  SHIPMENT = 'SHIPMENT',             // 4.1
  COMPLETED = 'COMPLETED',           // 4.2
  FAILED = 'FAILED',                 // 4.3
}

export enum Direction {
  PRIVATE = 'PRIVATE',
  DEALER = 'DEALER',
}

export enum GlassSupply {
  OURS = 'OURS',
  CLIENT = 'CLIENT',
}

export enum PaymentType {
  CASH = 'CASH',
  BANK = 'BANK',
}

export enum PaymentStatus {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
}

export enum FailReason {
  PRICE = 'PRICE',
  TECHNICAL = 'TECHNICAL',
  COMPETITOR = 'COMPETITOR',
  STOCK_SHORTAGE = 'STOCK_SHORTAGE',
}

export enum GlassOrderStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}
