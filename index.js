import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import { runSetupSeiton } from './lib/setup-seiton.js';

runSetupSeiton({ core, tc, io }).catch((error) => {
    core.setFailed(`Setup seiton failed: ${error.message}`);
});
