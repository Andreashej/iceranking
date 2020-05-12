#!/usr/bin/env node
/* eslint-disable no-console */

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { EnvType } from '../../main';

if (process.env.NODE_ENV === 'test') {
  dotenv.config();
}

// eslint-disable-next-line require-unicode-regexp
const LEGORN_ENV_PREFIX = 'LEGORN_';

interface IEnvVars {
  APPCENTER_API_TOKEN?: string;
  APPCENTER_APP_NAME?: string;
  APPCENTER_OWNER_NAME?: string;
  MATCH_PASSWORD?: string;
  GITHUB_REF?: string;
  BUNDLE_GIT__COM?: string;
  IOS_CERTIFICATES_GIT_URL?: string;
  GH_TOKEN?: string;
  PROJECT_OR_WORKSPACE_PATH?: string;
  XCODE_SCHEME_NAME?: string;
  SENTRY_AUTH_TOKEN?: string;
}

interface IBodyEnvVars {
  name: string;
  value: string;
  isSecret: boolean;
}
interface IBodyObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface IBuildScripts {
  [key: string]: string;
}

const envVars: IEnvVars = {
  APPCENTER_API_TOKEN: process.env.APPCENTER_API_TOKEN,
  APPCENTER_APP_NAME: process.env.APPCENTER_APP_NAME,
  APPCENTER_OWNER_NAME: process.env.APPCENTER_OWNER_NAME,
  BUNDLE_GIT__COM: process.env.BUNDLE_GIT__COM,
  GH_TOKEN: process.env.GH_TOKEN,
  GITHUB_REF: process.env.GITHUB_REF?.split('refs/heads/')[1],
  IOS_CERTIFICATES_GIT_URL: process.env.IOS_CERTIFICATES_GIT_URL,
  MATCH_PASSWORD: process.env.MATCH_PASSWORD,
  PROJECT_OR_WORKSPACE_PATH: process.env.PROJECT_OR_WORKSPACE_PATH,
  XCODE_SCHEME_NAME: process.env.XCODE_SCHEME_NAME,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
};

const fileExists: (fileName: string) => boolean = (fileName) => {
  const homeDir = process.env.GITHUB_WORKSPACE || '';

  return fs.existsSync(`${homeDir}/${fileName}`);
};
const missingEnvVars: string[] = [];

// Assertion functions are a new Typescript 3.7 feature:
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
const validateEnvVars: (vars: IEnvVars) => asserts vars is Required<IEnvVars> = (vars) => {
  Object.keys(envVars).forEach((key: string) => {
    const envVarsKey = key as keyof IEnvVars;
    if (!vars[envVarsKey] || typeof vars[envVarsKey] !== 'string') {
      missingEnvVars.push(key);
    }
  });

  if (missingEnvVars.length && process.env.NODE_ENV !== 'test') {
    throw new Error(
      `The following environment variables are undefined. Please provide them: ${missingEnvVars.toString()}`
    );
  }
};

export const setBranchConfig: (
  certificateEncoded: string,
  certificateFilename: string,
  profileEncoded: string,
  provisioningProfileFilename: string,
  method: 'POST' | 'PUT'
) => Promise<object> = (
  certificateEncoded,
  certificateFilename,
  profileEncoded,
  provisioningProfileFilename,
  method
) => {
  // disable consistent-return because the function has a different return behavior depending on
  // code branching https://eslint.org/docs/rules/consistent-return#when-not-to-use-it
  // eslint-disable-next-line consistent-return
  return new Promise((resolve, reject) => {
    // The code of a promise executor and promise handlers has an "invisible try..catch" around it.
    // If an exception happens, it gets caught and treated as a rejection.
    // https://javascript.info/promise-error-handling
    validateEnvVars(envVars);

    const {
      GITHUB_REF,
      APPCENTER_OWNER_NAME,
      APPCENTER_APP_NAME,
      APPCENTER_API_TOKEN,
      MATCH_PASSWORD,
      PROJECT_OR_WORKSPACE_PATH,
      XCODE_SCHEME_NAME,
      GH_TOKEN,
      BUNDLE_GIT__COM,
      SENTRY_AUTH_TOKEN,
    } = envVars;

    const encodedBranchName = encodeURIComponent(GITHUB_REF);
    const uri = `https://api.appcenter.ms/v0.1/apps/${APPCENTER_OWNER_NAME}/${APPCENTER_APP_NAME}/branches/${encodedBranchName}/config`;

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Token': APPCENTER_API_TOKEN,
    };

    const legoRNEnvs: IBodyEnvVars[] = Object.keys(process.env)
      .filter((key) => key.startsWith(LEGORN_ENV_PREFIX))
      .map((key) => ({
        name: key,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value: process.env[key]!,
        isSecret: true,
      }));
    const environmentVariables: IBodyEnvVars[] = legoRNEnvs.concat([
      {
        isSecret: true,
        name: 'GH_TOKEN',
        value: GH_TOKEN,
      },
      {
        isSecret: true,
        name: 'BUNDLE_GIT__COM',
        value: BUNDLE_GIT__COM,
      },
      {
        isSecret: false,
        name: 'APPCENTER_OWNER_NAME',
        value: APPCENTER_OWNER_NAME,
      },
      {
        isSecret: false,
        name: 'APPCENTER_APP_NAME',
        value: APPCENTER_APP_NAME,
      },
      {
        isSecret: true,
        name: 'APPCENTER_API_TOKEN',
        value: APPCENTER_API_TOKEN,
      },
      {
        isSecret: true,
        name: 'SENTRY_AUTH_TOKEN',
        value: SENTRY_AUTH_TOKEN,
      },
    ]);

    const paramObject: IBuildScripts = {};

    const postCloneExists = fileExists('appcenter-post-clone.sh');
    const preBuildExists = fileExists('appcenter-pre-build.sh');
    const postBuildExists = fileExists('appcenter-post-build.sh');

    if (postCloneExists) {
      paramObject.postClone = 'appcenter-post-clone.sh';
    }

    if (preBuildExists) {
      paramObject.preBuild = 'appcenter-pre-build.sh';
    }

    if (postBuildExists) {
      paramObject.postBuild = 'appcenter-post-build.sh';
    }

    const body: IBodyObject = {
      environmentVariables,
      signed: true,
      toolsets: {
        buildscripts: {
          'package.json': paramObject,
        },
        javascript: {
          nodeVersion: '12.x',
          packageJsonPath: 'package.json',
          runTests: false,
        },
        xcode: {
          appExtensionProvisioningProfileFiles: [],
          certificateEncoded,
          certificateFilename,
          certificatePassword: MATCH_PASSWORD,
          forceLegacyBuildSystem: true,
          projectOrWorkspacePath: PROJECT_OR_WORKSPACE_PATH,
          provisioningProfileEncoded: profileEncoded,
          provisioningProfileFilename,
          scheme: XCODE_SCHEME_NAME,
        },
      },
      trigger: 'manual',
    };

    fetch(uri, {
      body: JSON.stringify(body),
      headers,
      method,
    })
      .then(async (res) => {
        if (res.ok) {
          const response = await res.json();
          resolve(response);
        } else if (res.status === 409 && res.statusText === 'Conflict') {
          reject(409);
        } else {
          res.text().then((text: string) => {
            console.log('res.text: ', text);
            reject(text);
          });
        }
      })
      .catch((err) => {
        console.log('reject err', err);
        reject(err);
      });
  });
};

export const decryptCerts: (env: EnvType) => Promise<string> = (env) => {
  return new Promise((resolve, reject) => {
    const {
      MATCH_PASSWORD,
      APPCENTER_APP_NAME,
      BUNDLE_GIT__COM,
      IOS_CERTIFICATES_GIT_URL,
      XCODE_SCHEME_NAME,
    } = envVars;

    if (!XCODE_SCHEME_NAME) {
      return reject('missing XCODE_SCHEME_NAME');
    }

    try {
      execSync(`git clone https://${BUNDLE_GIT__COM}@github.com/${IOS_CERTIFICATES_GIT_URL}`);
      const certPath = './ios-certificates/certs/enterprise';
      const profilePath = './ios-certificates/profiles/enterprise';

      const certificateFiles = fs.readdirSync(`${certPath}`);
      const provProfileFiles = fs.readdirSync(`${profilePath}`);
      const certificateFilename = certificateFiles.find((file) => path.extname(file) === '.p12');
      const certificateCerFilename = certificateFiles.find((file) => path.extname(file) === '.cer');
      const provProfileFilename = provProfileFiles.find((file) => {
        switch (env) {
          case EnvType.prod:
            return path.basename(file).endsWith(`${XCODE_SCHEME_NAME}.mobileprovision`);
          case EnvType.qa:
            return (
              path.basename(file).endsWith(`${XCODE_SCHEME_NAME}.qa.mobileprovision`) ||
              path.basename(file).endsWith(`${XCODE_SCHEME_NAME}-qa.mobileprovision`)
            );
          case EnvType.dev:
            return (
              path.basename(file).endsWith(`${XCODE_SCHEME_NAME}.dev.mobileprovision`) ||
              path.basename(file).endsWith(`${XCODE_SCHEME_NAME}-dev.mobileprovision`)
            );
          default:
            return false;
        }
      });

      execSync(
        `openssl aes-256-cbc -k ${MATCH_PASSWORD} -in ${certPath}/${certificateFilename} -out key.pem -a -d -md md5`,
        { stdio: 'inherit' }
      );

      execSync(
        `openssl aes-256-cbc -k ${MATCH_PASSWORD} -in ${certPath}/${certificateCerFilename} -out cert.dem -a -d -md md5`,
        { stdio: 'inherit' }
      );

      execSync(`openssl x509 -inform der -in cert.dem -out cert.pem`, { stdio: 'inherit' });

      execSync(
        `openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem -password pass:${MATCH_PASSWORD}`,
        { stdio: 'inherit' }
      );

      execSync(
        `openssl aes-256-cbc -k ${MATCH_PASSWORD} -in ${profilePath}/${provProfileFilename} -out ${APPCENTER_APP_NAME}.mobileprovision -a -d -md md5`,
        { stdio: 'inherit' }
      );

      return resolve('ok');
    } catch (err) {
      return reject(err);
    }
  });
};
