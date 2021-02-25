#!/usr/bin/env node

import { getAppDetails, logInfo } from '../../../utils';
import { awAssignSmartgroup } from './awAssignSmartgroup';
import { awBeginInstall } from './awBeginInstall';
import { awUploadBlob } from './awUploadBlob';
import { getAppDetailsFromAW } from './getAppDetailsFromAw';
import { getSmartGroupIds } from './getSmartGroupIds';
import { retireApp } from './retireApp';

export const uploadToAirwatch: () => Promise<void> = async () => {
  try {
    const { AD_GROUP } = process.env;
    if (!AD_GROUP) {
      throw new Error('Missing environment variables');
    }

    logInfo('Getting app details from the .ipa file');
    const { version, bundleId, fileName, appName } = await getAppDetails();

    logInfo('Getting previous app versions from Airwatch');
    let previousApps = await getAppDetailsFromAW(bundleId);
    if (previousApps === undefined) {
      previousApps = [];
    }
    const activeApps = previousApps.filter((app) => app.Status === 'Active');
    const smartGroupIds = await getSmartGroupIds(
      AD_GROUP,
      bundleId,
      version,
      previousApps,
      activeApps
    );
    logInfo('Starting to upload the app to Airwatch');
    const blobId = await awUploadBlob(fileName);

    logInfo('Starting installing the app in Airwatch');
    const awAppId = await awBeginInstall(blobId, bundleId, version, appName);

    logInfo('Starting app retirement');
    await retireApp(activeApps);

    if (previousApps.length === 0) {
      logInfo('Assigning the smart group to the newly created app');

      return await awAssignSmartgroup(awAppId, smartGroupIds);
    }

    return logInfo('Smart group is already assigned to the app');
  } catch (error) {
    throw error;
  }
};
