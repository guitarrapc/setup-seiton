const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');
const { runSetupSeiton } = require('./lib/setup-seiton');

runSetupSeiton({ core, tc, io }).catch((error) => {
  core.setFailed(`Setup seiton failed: ${error.message}`);
});
