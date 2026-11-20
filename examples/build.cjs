'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const scenes = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenes.json'), 'utf8'));
const [selection, outputDirectory = 'build'] = process.argv.slice(2);
const requested = selection === '--all' ? scenes : scenes.filter(({ id }) => id === selection);

if (requested.length === 0) {
  console.error('Usage: node examples/build.cjs <scene-id | --all> [output-directory]');
  console.error(scenes.map(({ id }) => id).join('\n'));
  process.exit(1);
}

for (const { id, builder, poster } of requested) {
  const sceneDirectory = path.join(__dirname, id);
  const buildScript = path.resolve(sceneDirectory, builder);
  const recipe = path.join(sceneDirectory, 'scene.json');
  const output = path.resolve(outputDirectory, id + '.html');
  const result = spawnSync(process.execPath, [buildScript, recipe, output, '--review'], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  // Retain the original exhibition cover for the volcano.
  if (poster) {
    const exhibitionPoster = fs.readFileSync(path.resolve(sceneDirectory, poster));
    const html = fs.readFileSync(output, 'utf8');
    const embeddedPoster = /data:image\/png;base64,[A-Za-z0-9+/=]+/;
    if (!embeddedPoster.test(html)) throw new Error('Missing embedded poster in ' + output);
    fs.writeFileSync(output, html.replace(embeddedPoster, 'data:image/png;base64,' + exhibitionPoster.toString('base64')));
  }
}
