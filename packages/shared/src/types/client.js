"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyFileType = exports.CompanyType = void 0;
var CompanyType;
(function (CompanyType) {
    CompanyType["OOO"] = "OOO";
    CompanyType["IP"] = "IP";
    CompanyType["AO"] = "AO";
    CompanyType["SZ"] = "SZ";
    CompanyType["AGENT"] = "AGENT";
})(CompanyType || (exports.CompanyType = CompanyType = {}));
var CompanyFileType;
(function (CompanyFileType) {
    CompanyFileType["PARTNER_CARD"] = "PARTNER_CARD";
    CompanyFileType["CONTRACT"] = "CONTRACT";
    CompanyFileType["PERSONAL_DATA_CONSENT"] = "PERSONAL_DATA_CONSENT";
})(CompanyFileType || (exports.CompanyFileType = CompanyFileType = {}));
