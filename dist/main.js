"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const crypto = __importStar(require("crypto"));
const KEYS_SERVER_URL = 'https://keys.openpgp.org/';
const DEBUG = true;
function getCommitEmail() {
    return __awaiter(this, void 0, void 0, function* () {
        const output = yield execShellCommand('git log -1 --pretty=format:%ae');
        return output.trim();
    });
}
function getKeyByEmail(email) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = KEYS_SERVER_URL + 'vks/v1/by-email/' + encodeURIComponent(email);
        const response = yield fetch(url);
        if (response.status !== 200) {
            throw new Error(`Error fetching key for email ${email}`);
        }
        return yield response.text();
    });
}
function getPgpKeyId() {
    return __awaiter(this, void 0, void 0, function* () {
        const output = yield execShellCommand('git verify-commit HEAD');
        const pattern = /using (\w+) key (\w+)/;
        const match = pattern.exec(output);
        if (!match) {
            core.setFailed('Commit is not signed');
        }
        else if (match[1] !== 'RSA') {
            core.setFailed('You should use an RSA key');
        }
        if ((match === null || match === void 0 ? void 0 : match[2]) !== null)
            return match[2];
        return '';
    });
}
function getKeyById(keyId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (keyId === null)
            core.setFailed("RSA key error");
        const url = KEYS_SERVER_URL + 'vks/v1/by-keyid/' + encodeURIComponent(keyId);
        const response = yield fetch(url);
        if (response.status !== 200) {
            const url2 = KEYS_SERVER_URL + 'vks/v1/by-fingerprint/' + encodeURIComponent(keyId);
            const response2 = yield fetch(url2);
            if (response2.status !== 200) {
                core.setFailed(`RSA key not found in ${KEYS_SERVER_URL}`);
            }
            return yield response2.text();
        }
        return yield response.text();
    });
}
function validateCommit() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const email = yield getCommitEmail();
            const key = yield getKeyByEmail(email);
            const keyId = yield getPgpKeyId();
            const keyValidation = yield getKeyById(keyId);
            if (DEBUG) {
                console.log(key);
                console.log(keyId);
                console.log(keyValidation);
            }
            const hash1 = crypto.createHash('sha1').update(key).digest('hex');
            const hash2 = crypto.createHash('sha1').update(keyValidation).digest('hex');
            if (hash1 !== hash2) {
                core.setFailed(`Commit is not validated by ${KEYS_SERVER_URL}`);
            }
            core.setOutput("commit", 'Your commit is valid');
        }
        catch (error) {
            core.setFailed("Your commit isn't valid");
        }
    });
}
function execShellCommand(command) {
    return __awaiter(this, void 0, void 0, function* () {
        const exec = require('child_process').exec;
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(stdout || stderr);
                }
            });
        });
    });
}
validateCommit();
