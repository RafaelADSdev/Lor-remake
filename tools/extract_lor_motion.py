"""Inspect the selected local LoR exports; this script's output is not REA Evidence."""
import hashlib, json, pathlib, re, shutil, zipfile

game=pathlib.Path(__file__).resolve().parents[1]
base=game.parent
source=base/'communitydragon_historico/arquivos'
research=game/'research';research.mkdir(exist_ok=True)
names={
 'CardAnimationProfile.txt','CardSoundProfile.txt','CardVfxProfile.txt',
 'SummonReveal_Unit_Activate_Timeline.txt','SummonReveal_Hand_Activate_Timeline.txt',
 'CardDraw_Local_FromDeck_CardEffect_Activate_Timeline.txt',
 'CardDraw_Local_FromDrawToHand_CardEffect_Activate_Timeline.txt',
 'CardDraw_Opponent_FromDeck_CardEffect_Activate_Timeline.txt',
 'Combat_Block_CardEffect_Activate_Timeline.txt','ShardIn_Activate_Timeline.txt',
 'Damage.txt','Buff.txt','Heal.txt','HandCardEffects.txt','AttackCardEffects.txt','BlockCardEffects.txt',
 'Death_Exit.txt','Death_MarkedDying.txt','SummonReveal.txt','StrikeUnit.txt',
}
paths=[p for p in source.rglob('*.txt') if p.name in names]
records=[]
for p in paths:
 text=p.read_text(encoding='utf-8');lines=text.splitlines()
 fields=[{'line':i+1,'text':s.strip()} for i,s in enumerate(lines)
         if re.search(r'm_FixedDuration|m_Framerate|m_DurationMode|VariableName|StartTime|Sound.*Event| string Event|RequirementAsJson',s)]
 records.append({'path':str(p.relative_to(base)).replace('\\','/'),
 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'fields':fields,
 'limitation':'Static CommunityDragon historical export; unresolved PPtr do not establish runtime trajectories or duration.'})
textures={
 'creation-shine.png':'assets/assetlibrary/cardeffects/cardcreationdeath/shardin/vfx/CardCreation_Shine_Alpha_TX.png',
 'death-crack.png':'assets/assetlibrary/cardeffects/cardcreationdeath/deathmarked/vfx/DeathMarked_Crack_Alpha_TX.png',
 'summon-flash.png':'assets/art/vfx/textures/flipbooks/pogflashes/Pog_011_Flash_Flipbook_TX.png',
}
destination=game/'assets/lor-motion';destination.mkdir(exist_ok=True)
for name,rel in textures.items():
 p=source/rel;shutil.copyfile(p,destination/name);paths.append(p)
 records.append({'path':str(p.relative_to(base)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
 'copiedTo':'assets/lor-motion/'+name,'limitation':'Original texture reused; shader, blending and playback reconstructed for the browser.'})
report={'method':'Local text parsing and source hashing, guided by REA skill; not decompilation or runtime observation.',
 'sourceVersion':'CommunityDragon historical snapshot, separately from current client build 7-10-14',
 'records':records,'unknowns':['PPtr tracks unresolved across historical Unity containers','Original curves and transforms','Effective runtime durations','Current-client parity','Original Wwise sound recordings for these events']}
(research/'local-motion-records.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(research/'lor-motion-source-snapshot.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in paths:z.write(p,p.relative_to(base).as_posix())
 z.write(research/'local-motion-records.json','local-motion-records.json')
config={
 'version':3,'source':'research/local-motion-records.json',
 'observed':{'unitRevealFixedMs':833.333333333333,'handRevealFixedMs':83.3333333333333,'drawFromDeckFixedMs':1000,'drawToHandFixedMs':1000,'opponentDrawFixedMs':416.666666666667,'editorFrameRate':60,
 'damageOffsetsMs':{'cast':0,'missile':100,'impact':200}},
 'adapted':{'drawRevealMs':350,'drawToHandMs':280,'unitTravelMs':260,'strikeWindupMs':90,'strikeTravelMs':125,'strikeReturnMs':190,'strikeGapMs':80,'deathMs':380},
 'limitation':'Observed fixed-duration fields and display offsets are reference values, not measured complete animation durations. Adapted browser timings are explicitly separate.'}
(game/'lor-motion-profile.js').write_text('window.LOR_MOTION_PROFILE = '+json.dumps(config,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print(f'{len(paths)} sources retained; selected textures copied unchanged; profile values labelled observed/adapted.')
