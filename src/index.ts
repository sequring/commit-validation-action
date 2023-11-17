import * as core from '@actions/core'
import * as github from '@actions/github'
import * as crypto from 'crypto'
import fetch from 'node-fetch'
import * as fs from 'fs'

const KEYS_SERVER_URL = 'https://keys.openpgp.org/'
const DEBUG = false
const GITHUB_KEY = "4AEE18F83AFDEB23"

interface ConfigUser {
  allow_without_validation: string
}
interface Config {
users: ConfigUser
}

async function getCommitEmail(): Promise<string> {
  const output = await execShellCommand('git log -1 --pretty=format:%ae')
  return output.trim()
}

async function getKeyByEmail(email: string): Promise<string> {
  const url = KEYS_SERVER_URL + 'vks/v1/by-email/' + encodeURIComponent(email)
  const response = await fetch(url)
  if (response.status !== 200) {
    throw new Error(`Error fetching key for email ${email}`)
  }
  return await response.text()
}

async function getPgpKeyId(): Promise<string> {
  const output = await execShellCommandPassError('git verify-commit HEAD')
  const pattern = /using (\w+) key (\w+)/
  const match = pattern.exec(output)
  if (!match) {
    core.setFailed('Commit is not signed')
    await core.summary.addRaw(`❌ Commit is not signed`).write();
  } else if (match[1] !== 'RSA') {
    core.setFailed('You should use an RSA key')
    await core.summary.addRaw(`❌ You should use an RSA key`).write();
  }
  if (match?.[2] !== null) return match![2]
  return ''
}

async function getKeyById(keyId: string): Promise<string> {
  if (keyId === null) core.setFailed('RSA key error')
  const url = KEYS_SERVER_URL + 'vks/v1/by-keyid/' + encodeURIComponent(keyId)
  const response = await fetch(url)
  if (response.status !== 200) {
    const url2 =
      KEYS_SERVER_URL + 'vks/v1/by-fingerprint/' + encodeURIComponent(keyId)
    const response2 = await fetch(url2)
    if (response2.status !== 200) {
      core.setFailed(`RSA key not found in ${KEYS_SERVER_URL}`)
    }
    return await response2.text()
  }
  return await response.text()
}

async function execShellCommand(command: string): Promise<string> {
  const exec = require('child_process').exec
  return new Promise<string>((resolve, reject) => {
    exec(command, (error: any, stdout: string, stderr: string) => {
      if (error) {
        reject(error)
      } else {
        resolve(stdout || stderr)
      }
    })
  })
}

async function execShellCommandPassError(command: string): Promise<string> {
  const exec = require('child_process').exec
  return new Promise<string>((resolve, reject) => {
    exec(command, (error: any, stdout: string, stderr: string) => {
      if (error) {
        resolve(stdout || stderr)
      } else {
        resolve(stdout || stderr)
      }
    })
  })
}

async function validateCommit() {
  const dir = fs.realpathSync(process.cwd());
  const isUseConfig: string = core.getInput('use_config')
  const configFile: string = core.getInput('config_file')
  

  try {
    const email = await getCommitEmail()
    if (email.includes('@users.noreply.github.com')) {
      core.setOutput('commit', 'System email is being used')
      await core.summary.addRaw("The email address associated with GitHub noreply has already been used. I cannot validate the commit or pull reques").write();
      return 
    }

    if (isUseConfig === "true") {
        const jsonString = fs.readFileSync(configFile, 'utf-8');
        let jsonData: Config = JSON.parse(jsonString);
        if (DEBUG){
          console.log(jsonData)
        }
        if(jsonData.users.allow_without_validation.includes(email) === true) {
          core.setOutput('commit', 'Your commit is valid')
          await core.summary.addRaw("✅ Your commit is trust for us ").write();
          return
        }
    }

    const key = await getKeyByEmail(email)
    const keyId = await getPgpKeyId()
    if(keyId === GITHUB_KEY) {
      core.setOutput('commit', 'Your commit is valid')
      await core.summary.addRaw("✅ Your commit is valid ").write()
      return
    }
    const keyValidation = await getKeyById(keyId)
    if (DEBUG) {
      console.log(key)
      console.log(keyId)
      console.log(keyValidation)
    }

    const hash1 = crypto.createHash('sha1').update(key).digest('hex')
    const hash2 = crypto.createHash('sha1').update(keyValidation).digest('hex')
    if (hash1 !== hash2) {
      core.setFailed(`Commit is not validated by ${KEYS_SERVER_URL}`)
      await core.summary.addRaw(`❌ Commit is not validated by ${KEYS_SERVER_URL}`).write()
    }
    core.setOutput('commit', 'Your commit is valid')
    await core.summary.addRaw("✅ Your commit is valid ").write()
  } catch (error) {
    core.setFailed("error: " + error)
  }

}


validateCommit()
