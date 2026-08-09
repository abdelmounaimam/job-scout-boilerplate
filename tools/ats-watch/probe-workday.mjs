#!/usr/bin/env node
// Sondeur Workday. Il existe séparément de discover.mjs pour une raison simple :
// Workday demande DEUX identifiants, le tenant et le site, et le site ne se
// déduit pas du nom de la boîte. discover.mjs, qui ne dérive que des slugs, ne
// peut donc pas le trouver. Ici on croise une liste de tenants avec une liste de
// sites plausibles.
//
// C'est important pour un profil d'ingénierie industrielle : l'aéronautique,
// l'automobile, la défense et le ferroviaire sont massivement sur Workday, et
// ces employeurs n'apparaissent sur AUCUN des boards orientés start-up.
//
//   node probe-workday.mjs                     sonde la liste intégrée
//   node probe-workday.mjs --promote           ajoute les trouvailles à watchlist.json
//   node probe-workday.mjs renault stellantis  ne sonde que ces tenants
//
// ⚠️ Débit volontairement bas. Un sondage en masse qui rend zéro doit être
// re-mesuré au ralenti avant d'être écrit comme un fait : un throttling avalé
// ressemble trait pour trait à une absence de board.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBoard } from './adapters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WATCHLIST = join(HERE, 'watchlist.json');

// Tenants plausibles. Le tenant est la partie avant `.wdN.myworkdayjobs.com`.
// ⚠️ À REMPLIR pour le marché du candidat. Vide par défaut, parce qu'une liste
// de tenants est propre à un secteur : l'aéronautique française n'a rien à voir
// avec la santé américaine. Le tenant est la partie avant `.wdN.myworkdayjobs.com`
// dans l'URL carrières de l'employeur.
const TENANTS = [
  // 'acme', 'globex',
];

// Noms de site rencontrés en pratique. La casse compte.
const SITES = [
  'Careers', 'External', 'careers', 'External_Careers', 'ExternalCareers',
  'ExternalCareerSite', 'Global_Careers', 'GlobalCareers', 'Jobs', 'jobs',
  'Recrutement', 'Carrieres', 'CareerSite', 'Externe',
];

const HOSTS = ['wd3', 'wd1', 'wd5'];

const args = process.argv.slice(2);
const PROMOTE = args.includes('--promote');
const only = args.filter((a) => !a.startsWith('--'));
const tenants = only.length ? only : TENANTS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trouves = [];
let sondes = 0;

for (const slug of tenants) {
  let touche = null;
  for (const host of HOSTS) {
    for (const site of SITES) {
      sondes += 1;
      const res = await fetchBoard({ ats: 'workday', slug, site, host }, { timeout: 10000 });
      if (!res.error && res.jobs?.length) { touche = { slug, site, host, jobs: res.jobs }; break; }
      await sleep(60);
    }
    if (touche) break;
  }
  if (touche) {
    trouves.push(touche);
    console.log(`★ ${touche.slug} / ${touche.site} [${touche.host}] — ${touche.jobs.length} req(s)`);
    for (const j of touche.jobs.slice(0, 3)) {
      console.log(`    ${j.title.slice(0, 62)}  ·  ${(j.location || '?').slice(0, 40)}`);
    }
    console.log('    ⚠ vérifier que ces intitulés correspondent bien à cette boîte');
  }
}

console.log(`\n${trouves.length} board(s) Workday trouvé(s) sur ${tenants.length} tenants (${sondes} sondes).`);

if (PROMOTE && trouves.length) {
  const wl = JSON.parse(readFileSync(WATCHLIST, 'utf8'));
  const connus = new Set(wl.companies.map((c) => `${c.ats}:${c.slug}:${c.site ?? ''}`));
  let ajoutes = 0;
  const today = process.env.TODAY ?? new Date().toISOString().slice(0, 10);
  for (const t of trouves) {
    if (connus.has(`workday:${t.slug}:${t.site}`)) continue;
    wl.companies.push({
      name: t.slug, ats: 'workday', slug: t.slug, site: t.site,
      ...(t.host !== 'wd3' ? { host: t.host } : {}),
      applied: false, note: `Workday trouvé le ${today}, ${t.jobs.length} reqs au sondage`,
    });
    ajoutes += 1;
  }
  writeFileSync(WATCHLIST, `${JSON.stringify(wl, null, 2)}\n`);
  console.log(`✓ ${ajoutes} board(s) ajouté(s) à watchlist.json.`);
  console.log('  ⚠ Le champ `name` reprend le tenant : le remplacer par le vrai nom de la boîte.');
} else if (trouves.length) {
  console.log('(lecture seule — relancer avec --promote pour les ajouter)');
}
