import * as core from '@actions/core';
import * as github from '@actions/github';
import * as crypto from 'crypto';

const KEYS_SERVER_URL = 'https://keys.openpgp.org/';
const DEBUG = true;

async function getCommitEmail(): Promise<string> {
  const output = await execShellCommand('git log -1 --pretty=format:%ae');
  return output.trim();
}

async function getKeyByEmail(email: string): Promise<string> {
  const url = KEYS_SERVER_URL + 'vks/v1/by-email/' + encodeURIComponent(email);
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(`Error fetching key for email ${email}`);
  }
  return await response.text();
}

async function getPgpKeyId(): Promise<string> {
  const output = await execShellCommand('git verify-commit HEAD');
  const pattern = /using (\w+) key (\w+)/;
  const match = pattern.exec(output);
  if (!match) {
    core.setFailed('Commit is not signed');
  } else if (match[1] !== 'RSA') {
    core.setFailed('You should use an RSA key');
  }
  if (match?.[2] !== null)
    return match![2];
  return '';
}



async function getKeyById(keyId: string): Promise<string> {
  if (keyId === null)
    core.setFailed("RSA key error");
  const url = KEYS_SERVER_URL + 'vks/v1/by-keyid/' + encodeURIComponent(keyId);
  const response = await fetch(url);
  if (response.status !== 200) {
    const url2 = KEYS_SERVER_URL + 'vks/v1/by-fingerprint/' + encodeURIComponent(keyId);
    const response2 = await fetch(url2);
    if (response2.status !== 200) {
      core.setFailed(`RSA key not found in ${KEYS_SERVER_URL}`);
    }
    return await response2.text();
  }
  return await response.text();
}

async function validateCommit() {
  try {
    const email = await getCommitEmail();
    const key = await getKeyByEmail(email);
    const keyId = await getPgpKeyId();
    const keyValidation = await getKeyById(keyId);
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
  } catch (error) {
    core.setFailed("Your commit isn't valid");
  }
}

async function execShellCommand(command: string): Promise<string> {
  const exec = require('child_process').exec;
  return new Promise<string>((resolve, reject) => {
    exec(command, (error: any, stdout: string, stderr: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

validateCommit();
