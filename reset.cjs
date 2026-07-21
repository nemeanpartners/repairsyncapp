const { execSync } = require('child_process');
execSync('git reset --hard HEAD', {stdio: 'inherit'});
