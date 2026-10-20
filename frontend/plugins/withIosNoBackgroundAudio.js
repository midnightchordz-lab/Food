const { withInfoPlist } = require('@expo/config-plugins');

// expo-audio's own plugin always adds 'audio' to UIBackgroundModes on iOS
// (tied to the same enableBackgroundPlayback flag that also grants Android's
// FOREGROUND_SERVICE permission, so it can't be disabled for iOS alone
// without touching Android). withInfoPlist only ever modifies the iOS
// Info.plist, so stripping the entry here is iOS-only by construction.
module.exports = function withIosNoBackgroundAudio(config) {
  return withInfoPlist(config, (config) => {
    if (Array.isArray(config.modResults.UIBackgroundModes)) {
      config.modResults.UIBackgroundModes = config.modResults.UIBackgroundModes.filter(
        (mode) => mode !== 'audio'
      );
    }
    return config;
  });
};
