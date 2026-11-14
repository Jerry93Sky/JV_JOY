-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "CompanyType" AS ENUM ('OOO', 'IP', 'AO', 'SZ', 'AGENT');

-- CreateEnum
CREATE TYPE "CompanyFileType" AS ENUM ('PARTNER_CARD', 'CONTRACT', 'PERSONAL_DATA_CONSENT');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('APPLICATION', 'CALCULATION', 'PROPOSAL', 'AWAITING_PAYMENT', 'PAID', 'ASSEMBLY', 'PAINTING', 'PREP_SHIPMENT', 'INSTALL_FIRST', 'GLUING', 'INSTALL_SECOND', 'SHIPMENT', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('PRIVATE', 'DEALER');

-- CreateEnum
CREATE TYPE "GlassSupply" AS ENUM ('OURS', 'CLIENT');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FailReason" AS ENUM ('PRICE', 'TECHNICAL', 'COMPETITOR', 'STOCK_SHORTAGE');

-- CreateEnum
CREATE TYPE "GlassOrderStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DealFileType" AS ENUM ('ATTACHMENT', 'INVOICE', 'SHIPMENT_PHOTO', 'SHIPMENT_DOC', 'GLASS_DRAWING');

-- CreateEnum
CREATE TYPE "WriteoffReason" AS ENUM ('INVENTORY', 'DEFECT');

-- CreateEnum
CREATE TYPE "ParamType" AS ENUM ('NUMBER', 'SELECT', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "ParamKind" AS ENUM ('INPUT', 'CALCULATED', 'CONSTANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL,
    "inn" TEXT,
    "ogrn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountNum" TEXT NOT NULL,
    "bik" TEXT NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactCompany" (
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ContactCompany_pkey" PRIMARY KEY ("contactId","companyId")
);

-- CreateTable
CREATE TABLE "CompanyRelation" (
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "CompanyRelation_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE "CompanyFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyFileType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CompanyFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'APPLICATION',
    "direction" "Direction" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT,
    "comment" TEXT,
    "isAgentOrder" BOOLEAN NOT NULL DEFAULT false,
    "agentPercent" DECIMAL(5,2),
    "glassSupply" "GlassSupply" NOT NULL DEFAULT 'OURS',
    "needPainting" BOOLEAN NOT NULL DEFAULT false,
    "paintAllOneColor" BOOLEAN NOT NULL DEFAULT true,
    "paymentType" "PaymentType",
    "paymentStatus" "PaymentStatus",
    "paidAmount" DECIMAL(12,2),
    "isOfficialPayment" BOOLEAN NOT NULL DEFAULT false,
    "failReason" "FailReason",
    "paintingCompany" TEXT,
    "paintingSentAt" TIMESTAMP(3),
    "paintingOverdue" BOOLEAN NOT NULL DEFAULT false,
    "paintingCost" DECIMAL(12,2),
    "transportCost" DECIMAL(12,2),
    "glassOrderStatus" "GlassOrderStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "glassDrawingUrl" TEXT,
    "glassCostPrice" DECIMAL(12,2),
    "invoiceUrl" TEXT,
    "assemblePdfUrl" TEXT,
    "paintingPdfUrl" TEXT,
    "gluingSchemaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "paintColor" TEXT,

    CONSTRAINT "DealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealService" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DealService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFile" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DealFileType" NOT NULL,

    CONSTRAINT "DealFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialProposal" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "isPaintable" BOOLEAN NOT NULL DEFAULT false,
    "markup" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "reservedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoUrl" TEXT,
    "editableUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Writeoff" (
    "id" TEXT NOT NULL,
    "reason" "WriteoffReason" NOT NULL,
    "comment" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editableUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Writeoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WriteoffItem" (
    "id" TEXT NOT NULL,
    "writeoffId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "WriteoffItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlazingSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlazingSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemParameter" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "type" "ParamType" NOT NULL,
    "paramKind" "ParamKind" NOT NULL,
    "options" JSONB,
    "formula" TEXT,
    "defaultValue" TEXT,
    "showInProposal" BOOLEAN NOT NULL DEFAULT false,
    "showInAssembly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLimit" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "minValue" DECIMAL(12,4),
    "maxValue" DECIMAL(12,4),

    CONSTRAINT "SystemLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemComponent" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "formula" TEXT NOT NULL,

    CONSTRAINT "SystemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "comment" TEXT,
    "dealId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountThreshold" (
    "id" TEXT NOT NULL,
    "minTurnover" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "DiscountThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_number_key" ON "Deal"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_name_key" ON "ProductType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelation" ADD CONSTRAINT "CompanyRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelation" ADD CONSTRAINT "CompanyRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyFile" ADD CONSTRAINT "CompanyFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealItem" ADD CONSTRAINT "DealItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealService" ADD CONSTRAINT "DealService_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealService" ADD CONSTRAINT "DealService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFile" ADD CONSTRAINT "DealFile_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ProductType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptItem" ADD CONSTRAINT "ReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteoffItem" ADD CONSTRAINT "WriteoffItem_writeoffId_fkey" FOREIGN KEY ("writeoffId") REFERENCES "Writeoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WriteoffItem" ADD CONSTRAINT "WriteoffItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemParameter" ADD CONSTRAINT "SystemParameter_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GlazingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemLimit" ADD CONSTRAINT "SystemLimit_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "SystemParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemComponent" ADD CONSTRAINT "SystemComponent_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GlazingSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemComponent" ADD CONSTRAINT "SystemComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
