"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParamKind = exports.ParamType = exports.WriteoffReason = void 0;
var WriteoffReason;
(function (WriteoffReason) {
    WriteoffReason["INVENTORY"] = "INVENTORY";
    WriteoffReason["DEFECT"] = "DEFECT";
})(WriteoffReason || (exports.WriteoffReason = WriteoffReason = {}));
var ParamType;
(function (ParamType) {
    ParamType["NUMBER"] = "NUMBER";
    ParamType["SELECT"] = "SELECT";
    ParamType["BOOLEAN"] = "BOOLEAN";
})(ParamType || (exports.ParamType = ParamType = {}));
var ParamKind;
(function (ParamKind) {
    ParamKind["INPUT"] = "INPUT";
    ParamKind["CALCULATED"] = "CALCULATED";
    ParamKind["CONSTANT"] = "CONSTANT";
})(ParamKind || (exports.ParamKind = ParamKind = {}));
