"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlassOrderStatus = exports.FailReason = exports.PaymentStatus = exports.PaymentType = exports.GlassSupply = exports.Direction = exports.DealStage = void 0;
var DealStage;
(function (DealStage) {
    DealStage["APPLICATION"] = "APPLICATION";
    DealStage["CALCULATION"] = "CALCULATION";
    DealStage["PROPOSAL"] = "PROPOSAL";
    DealStage["AWAITING_PAYMENT"] = "AWAITING_PAYMENT";
    DealStage["PAID"] = "PAID";
    DealStage["ASSEMBLY"] = "ASSEMBLY";
    DealStage["PAINTING"] = "PAINTING";
    DealStage["PREP_SHIPMENT"] = "PREP_SHIPMENT";
    DealStage["INSTALL_FIRST"] = "INSTALL_FIRST";
    DealStage["GLUING"] = "GLUING";
    DealStage["INSTALL_SECOND"] = "INSTALL_SECOND";
    DealStage["SHIPMENT"] = "SHIPMENT";
    DealStage["COMPLETED"] = "COMPLETED";
    DealStage["FAILED"] = "FAILED";
})(DealStage || (exports.DealStage = DealStage = {}));
var Direction;
(function (Direction) {
    Direction["PRIVATE"] = "PRIVATE";
    Direction["DEALER"] = "DEALER";
})(Direction || (exports.Direction = Direction = {}));
var GlassSupply;
(function (GlassSupply) {
    GlassSupply["OURS"] = "OURS";
    GlassSupply["CLIENT"] = "CLIENT";
})(GlassSupply || (exports.GlassSupply = GlassSupply = {}));
var PaymentType;
(function (PaymentType) {
    PaymentType["CASH"] = "CASH";
    PaymentType["BANK"] = "BANK";
})(PaymentType || (exports.PaymentType = PaymentType = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["FULL"] = "FULL";
    PaymentStatus["PARTIAL"] = "PARTIAL";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var FailReason;
(function (FailReason) {
    FailReason["PRICE"] = "PRICE";
    FailReason["TECHNICAL"] = "TECHNICAL";
    FailReason["COMPETITOR"] = "COMPETITOR";
    FailReason["STOCK_SHORTAGE"] = "STOCK_SHORTAGE";
})(FailReason || (exports.FailReason = FailReason = {}));
var GlassOrderStatus;
(function (GlassOrderStatus) {
    GlassOrderStatus["NOT_STARTED"] = "NOT_STARTED";
    GlassOrderStatus["IN_PROGRESS"] = "IN_PROGRESS";
    GlassOrderStatus["COMPLETED"] = "COMPLETED";
})(GlassOrderStatus || (exports.GlassOrderStatus = GlassOrderStatus = {}));
