/* Template compiled by build_pwa.py. No forced activation during a duel. */
'use strict';
const VERSION = "187f28c8c396";
const CORE = [
  "animation-gallery.css?v=0.29",
  "animation-gallery.js?v=0.29",
  "app.js?v=0.31",
  "arena-ambient-data.js",
  "arena-ambient.css?v=0.20",
  "arena-ambient.js",
  "arena-backdrop.js?v=0.25",
  "arena-chrome.js?v=3",
  "arena-hud.js?v=0.29",
  "arena-scene.css?v=0.25",
  "arena-scene.js?v=0.18",
  "arena-themes.css",
  "arena-view.js?v=0.34.2",
  "arena.css",
  "assets/01DE012.png",
  "assets/01DE028.png",
  "assets/arena-v2.png",
  "assets/arenas/action-button.png",
  "assets/arenas/action-frame.svg",
  "assets/arenas/backgrounds/bandlecity.js",
  "assets/arenas/backgrounds/bilgewater.js",
  "assets/arenas/backgrounds/demacia.js",
  "assets/arenas/backgrounds/freljord.js",
  "assets/arenas/backgrounds/ionia.js",
  "assets/arenas/backgrounds/noxus.js",
  "assets/arenas/backgrounds/piltover.js",
  "assets/arenas/backgrounds/rift.js",
  "assets/arenas/backgrounds/shadowisles.js",
  "assets/arenas/backgrounds/shurima.js",
  "assets/arenas/backgrounds/targon.js",
  "assets/arenas/backgrounds/zaun.js",
  "assets/arenas/cardback.png",
  "assets/arenas/hud/mana-pips.js",
  "assets/arenas/hud/sprites.js",
  "assets/arenas/nexus-health-frame.svg",
  "assets/arenas/token/blade.png",
  "assets/arenas/token/defense-shield.png",
  "assets/arenas/token/defense.png",
  "assets/arenas/token/flame.png",
  "assets/arenas/token/initiative.png",
  "assets/arenas/token/shard1.png",
  "assets/arenas/token/shard2.png",
  "assets/arenas/token/shard3.png",
  "assets/arenas/token/shard4.png",
  "assets/arenas/token/shard5.png",
  "assets/beaufort-bold.ttf",
  "assets/beaufort.ttf",
  "assets/campaign/portraits/bilgewater.webp",
  "assets/campaign/portraits/demacia.webp",
  "assets/campaign/portraits/freljord.webp",
  "assets/campaign/portraits/ionia.webp",
  "assets/campaign/portraits/ixtal.webp",
  "assets/campaign/portraits/noxus.webp",
  "assets/campaign/portraits/piltover-zaun.webp",
  "assets/campaign/portraits/shadow-isles.webp",
  "assets/campaign/portraits/shurima.webp",
  "assets/campaign/portraits/targon.webp",
  "assets/campaign/regions/bilgewater.png",
  "assets/campaign/regions/demacia.png",
  "assets/campaign/regions/freljord.png",
  "assets/campaign/regions/ionia.png",
  "assets/campaign/regions/ixtal.png",
  "assets/campaign/regions/noxus.png",
  "assets/campaign/regions/piltover-zaun.png",
  "assets/campaign/regions/shadow-isles.png",
  "assets/campaign/regions/shurima.png",
  "assets/campaign/regions/targon.png",
  "assets/campaign/runeterra-map.jpg",
  "assets/outcome/defeat.png",
  "assets/outcome/draw.png",
  "assets/outcome/victory.png",
  "assets/pwa/apple-touch-icon.png",
  "assets/pwa/card-offline.svg",
  "assets/pwa/icon-192.png",
  "assets/pwa/icon-512.png",
  "assets/pwa/maskable-512.png",
  "assets/univers.ttf",
  "attack-token-data.js",
  "attack-token.css?v=5",
  "attack-token.js?v=4",
  "campaign-data.js?v=0.32",
  "campaign-map-data.js?v=0.34",
  "campaign-map.css?v=0.34",
  "campaign-map.js?v=0.34",
  "campaign-routes.js",
  "campaign-ui.js?v=0.34",
  "campaign.css?v=0.34.1",
  "campaign.js?v=0.32",
  "card-effects-data.js?v=0.29",
  "card-effects.css?v=0.29",
  "card-effects.js?v=0.29",
  "card-presentation.js?v=0.29",
  "cards.js?v=0.30",
  "champion-cinematic.css",
  "champion-cinematic.js?v=0.30.1",
  "champion-presentation.js?v=0.30.1",
  "champions.css",
  "champions.js?v=0.29",
  "cinematic-library-data.js?v=0.29",
  "collection.js?v=0.32",
  "combat-clarity.css?v=0.29",
  "combat-motion.js",
  "combat-view.js",
  "current-motion-data.js",
  "current-motion.js",
  "deck-builder.css?v=0.30",
  "deck-tools.js?v=0.30",
  "duel-outcome.css?v=0.24",
  "duel-outcome.js?v=0.19",
  "duel-polish.css?v=names1",
  "duel-ui.css",
  "duel-ui.js",
  "engine.js?v=0.29",
  "game-audio.js",
  "header.css?v=2",
  "index.html",
  "initiative-token-data.js",
  "initiative-token.js?v=5",
  "lor-motion-profile.js",
  "lor-motion.css",
  "manifest.webmanifest",
  "mobile-pwa.css",
  "motion-v3.js",
  "native-nexus-end-data.js",
  "native-outcome-data.js",
  "native-outcome.js",
  "native-sounds-data.js?v=0.28",
  "nexus-data.js",
  "nexus-fallback-data.js?v=0.24",
  "nexus-hud.css?v=0.25",
  "nexus-view.js?v=0.24",
  "official-catalog.js",
  "opponents.js?v=2",
  "pwa-artwork.json",
  "pwa.js",
  "regional-audio-data.js",
  "regional-audio.js",
  "riot-deck-code.js",
  "spell-presentation.css",
  "style.css",
  "video-motion.css",
  "welcome-settings-motion.js?v=0.27",
  "welcome.css?v=0.33"
];
const REVISIONS = {
  "animation-gallery.css?v=0.29": "d99a09f3730545c2807d40809e1db45b24da1b547c99e171ddecaf0ed37f30a5",
  "animation-gallery.js?v=0.29": "66d60a64d048124763676e3d7f39dc3bf78ee28bb8418d18bebad4bc6c86f28e",
  "app.js?v=0.31": "12ee87e45679955d7f01b5558e3734b2eae14db25e9894ee807ccea62ad5738a",
  "arena-ambient-data.js": "fc5e651bf3ff170757dbc2b5420cc2b46033303ae9bd39b921e4d49d0df2d851",
  "arena-ambient.css?v=0.20": "e4512636de1b5718be475f433e0ad0dc51534670bc8e9081ed47835721858bbd",
  "arena-ambient.js": "1c209c17d16f1930b28bcd09f0ecb8aabce8df6c3a10cba49d6a6e23be9202a0",
  "arena-backdrop.js?v=0.25": "a35ad3c7f2fe324c0e42a6ff8a36bca093f550d69b3a0c13dfd26d82d224a01d",
  "arena-chrome.js?v=3": "2d46ffabf720a5b114ae262655e2fe5aeea103cab37436e18bdf4fdf901d4f0e",
  "arena-hud.js?v=0.29": "e799fa83169956575a61ec39f11561de17c0d4bbc556ccfb17492b1e9d03124a",
  "arena-scene.css?v=0.25": "25de092512d3795cd14a16f2a4aa9261d68c34a5dfa399c4c433e95f872eb2f3",
  "arena-scene.js?v=0.18": "392cb638ebe7109f4646b40c84220b70d027079b3714400a03e0e51294d4f284",
  "arena-themes.css": "85248f88d2ca9b1e4fa068e31851bec52fe172ae43848e7ff87f31e9ba1bb9c5",
  "arena-view.js?v=0.34.2": "a89745bba5580bc52223daa2989efd0f6a753621fd064337aebce0a6c5d28558",
  "arena.css": "6e967bc5eb8d05723807f6686f207bcfc34cd305ed0ab154919087f584269b66",
  "assets/01DE012.png": "de81dcc592ebe11ba06bc1d435d460c4bd950cb973970c571bfb2c7c587d739a",
  "assets/01DE028.png": "46b3f08593c717e19791f68e1437a48da82b91b3014a48a32715b7381bab9695",
  "assets/arena-v2.png": "aa8ace683f16deb02a1eae5dcdde54d723edcf4469ea2bc95ac8a8a0bc2061df",
  "assets/arenas/action-button.png": "bf44da9b238d36a5257290cd5f18231ceacc362a85b5a76fdcbfcc7ed94a7e21",
  "assets/arenas/action-frame.svg": "6f0bc88ad73069611f6b6295db2763ef4cacfeacf88997b1ebbd123e42251428",
  "assets/arenas/backgrounds/bandlecity.js": "29f9c8b926271284dfda528e48f4ea09a955e1157ea13ab547da6dfe6274e183",
  "assets/arenas/backgrounds/bilgewater.js": "6ae85764a80afa6240466e6232c1b8f870442cafb4e0202ff7bc7a806fe4d62f",
  "assets/arenas/backgrounds/demacia.js": "f7e893d5c5524d8950c4d473bf6939ca2fc9acb1123fb2c00f11e9c26dea2b9a",
  "assets/arenas/backgrounds/freljord.js": "1d7d47ed1b4a535cb39299a61034e45f7d3dedd908229eb51533557b97b54672",
  "assets/arenas/backgrounds/ionia.js": "2c6b510c47e42a33eb3cb2597ad827f379e3430dd213c9feefea5f96cfed947d",
  "assets/arenas/backgrounds/noxus.js": "8a58bcccf910f5afaa2021049b3dce35475eb7c862bf745f5eb50a4789664976",
  "assets/arenas/backgrounds/piltover.js": "8f6bd18ce569d27f33c13d3a9868acfbb6f34d3771d2c06b2d0fd738bba01b14",
  "assets/arenas/backgrounds/rift.js": "dd75e292e14dc48bc720b3a41a42533a41b2860cd8387dc7483fd910a6bd5742",
  "assets/arenas/backgrounds/shadowisles.js": "95d4d4a3f33ccdd543d038c3f8ebd58e31d7a10b47ac5eda3965326dfa8bcc12",
  "assets/arenas/backgrounds/shurima.js": "45a64fef5af8630e92842c2836c41f871323a07576f7a013e637746073e53c9f",
  "assets/arenas/backgrounds/targon.js": "1038ddb0591aa05fccbe2fc571d0260dc93d3eb2551565173a22a76777630213",
  "assets/arenas/backgrounds/zaun.js": "0e34edabd440d81781535e0b34c3ef5affa0a9999b5ee1bd67abe8ce49daaa5f",
  "assets/arenas/cardback.png": "5d8b982c80a76a980c830af321841dbe1bfd3cafa215553ff45dfbb7d5b4fc05",
  "assets/arenas/hud/mana-pips.js": "02cc4536239e414e922ca4117fa5407c25f2a896dfd1636f681a8c6b95013c62",
  "assets/arenas/hud/sprites.js": "dedf0b4decd57dbbcedf3deaaf2631e3f66562f081b8841bb6111fb65fc6eae3",
  "assets/arenas/nexus-health-frame.svg": "a38de1582c1c41221f3797cbbbbe62013905c59675cc6f2443e84defae5ea4b9",
  "assets/arenas/token/blade.png": "2038b13629a94dc817c01248179a33f04119c179a066ebd7a2415f92c8e99334",
  "assets/arenas/token/defense-shield.png": "c9c6f3cca8b99d338d6b03b4355776751f4060d914b93288ed5bf1713efa011a",
  "assets/arenas/token/defense.png": "4a495781ff9c96bf9a77baea33b9f912a65d8b9cc3901222862446c3480c7e0b",
  "assets/arenas/token/flame.png": "bd3dc1d6a395839c64dcf9e922dc2a6ea1e840ed1247cafc25eb7ea04fa55e42",
  "assets/arenas/token/initiative.png": "4a495781ff9c96bf9a77baea33b9f912a65d8b9cc3901222862446c3480c7e0b",
  "assets/arenas/token/shard1.png": "9f94cb41685c64e1377e68ca16ff74c17f1173984b3405c1cb27829033b4bcaa",
  "assets/arenas/token/shard2.png": "a6112c162eb62097dfc43fadddc6e4f792ed8ebcc11d46eefbc258176c520781",
  "assets/arenas/token/shard3.png": "fbc91cc2f1c157d7de6879a6b6aa7c370dd6158fe9985d7b355a3b4dceee461c",
  "assets/arenas/token/shard4.png": "48e8c87430fe05e3820a355adbe485ed2914a0037b3a4ae7fb1d674d6e6aa2aa",
  "assets/arenas/token/shard5.png": "04e87fb6f904d18be84db93ed49a146697c4ac8bf23d5a0118d58b02971b28b6",
  "assets/beaufort-bold.ttf": "f056036d22af8d0b3c3efe1b6087724efc46d9fd3711f76bcd1e40fc8e1c4d43",
  "assets/beaufort.ttf": "2bcaf620e4574f0e8cacfacb44b823b31c10805f77f301197577e8309e3e2141",
  "assets/campaign/portraits/bilgewater.webp": "6cfccf77a48eb73369b51f5636410cb6c3ffd60cab650b7eb1621a170cbf17f6",
  "assets/campaign/portraits/demacia.webp": "8d9b5fc7e958938e23fbba86ccf2de286d5e51a3cae4bb3c6384b3d56a10b42b",
  "assets/campaign/portraits/freljord.webp": "283779e7ceb458d9c3c465c2f8c0be2fc5f0ae2161fd3c32505eb03987ced8a8",
  "assets/campaign/portraits/ionia.webp": "5862c07d318f1b509f65d2ebe9400e2c161a8462b5bcaddfadbf7cf3212050cc",
  "assets/campaign/portraits/ixtal.webp": "6bceaeea591129c5847f87a8212b0972bd75cec66ac8faaee68b113020073d60",
  "assets/campaign/portraits/noxus.webp": "ca70090abe35ddc88fdc328fa2b7b0a30e462ff512e5b602cdce6076f161499a",
  "assets/campaign/portraits/piltover-zaun.webp": "2dbca6c6e8e78ab6be766b30bc60252cadcd956ee7b21d78363de654f9561b89",
  "assets/campaign/portraits/shadow-isles.webp": "c51dd06b3c5e25b82773a2322830586b9a59a84220506ea7a896aa053b4b5b45",
  "assets/campaign/portraits/shurima.webp": "a8db3a4f038f772d2b0b0a0dc612b74931b00257630fb2f2f2c0d08e23de711a",
  "assets/campaign/portraits/targon.webp": "1f91cf40c8873174c09d1e01b222bf85be8d510a62c67095b612aa5ed8497e46",
  "assets/campaign/regions/bilgewater.png": "56514b4ba324d2b1b47422dd457cdcb5bfa0829ae7164234e69687c151788a7f",
  "assets/campaign/regions/demacia.png": "44ea9be511a7189375e8e911c2d5bb8d9488138ba875eb88e533996cc2fe6d42",
  "assets/campaign/regions/freljord.png": "4b6ae6afc5a9a19c8d2eb53b4ff59fe3f39522fb709b2992708429c22bb638dc",
  "assets/campaign/regions/ionia.png": "b88010e7ec6c099ded3ffe58da09e2fad999a8ee8879fa4094a3ab4a27f22bbb",
  "assets/campaign/regions/ixtal.png": "6ca6f650a1310a1fafd56a3cff5b9804530b14e7887150f79a3d0114eb1e5783",
  "assets/campaign/regions/noxus.png": "93d54b0f9e6c1f8e1fda6ca2e9e9999d1addd50a3bd2d70fbdf59acbe4733f2e",
  "assets/campaign/regions/piltover-zaun.png": "86c37a135e8fcd7a81c0c4e209e61acb44e8c5ff03fb353883043aef0a759520",
  "assets/campaign/regions/shadow-isles.png": "cd941245297a01a86de42d839449cd0615f8950b403836fd3dae0616ba69f53d",
  "assets/campaign/regions/shurima.png": "159b6d76bdbd596ceb9bf92726815562b1f3fbafcbafe26c30386a98acdfd7c1",
  "assets/campaign/regions/targon.png": "14eb969c7c9871f71ceaa209f9b13c9591d990d8fccdaa5c5b7267671690ad90",
  "assets/campaign/runeterra-map.jpg": "aed3301ae19f003e9a2b140f69b3b295f7056b33ab5cd754752a0556b41f6d60",
  "assets/outcome/defeat.png": "98e4a443e1824ea4c9a2bc71f2a64035cfe19a98404376a3017515e7e7c0245b",
  "assets/outcome/draw.png": "b5eeca26b10df623a488c82738836cedc4c8bd26e3e0c97ab40b206f952768ec",
  "assets/outcome/victory.png": "1cfe4f3d87460d08046f4507d8886a91227757d9849b245bb55898bb1102a42e",
  "assets/pwa/apple-touch-icon.png": "3b0c26368bf7581134764d313e77b64c7a1a56882551936bd58e3b363d378b52",
  "assets/pwa/card-offline.svg": "1a412242dc6e5d259ea282d651ca315729f109d5e52819a19bd04f28bf5ab000",
  "assets/pwa/icon-192.png": "6c64a6118cd7089825f02e3db4f7f27481010051ef60c546da52b1daadf48cdf",
  "assets/pwa/icon-512.png": "970138df203f4b6c30b7795054331b15837deda38c59c3cb7817a6aa3fafab23",
  "assets/pwa/maskable-512.png": "970138df203f4b6c30b7795054331b15837deda38c59c3cb7817a6aa3fafab23",
  "assets/univers.ttf": "e62b4fc29473ba73be8f66bb86acf434229db27e8b4249514fd5e01610433a6b",
  "attack-token-data.js": "ac1de087bc7051a59de6e1a762abc5d1a52cae797a7fd104c4036371fd1b2f90",
  "attack-token.css?v=5": "da676bb5756b0b36b9537f0e97ea9d03da9f67173274328dd429d6c2fc3ae065",
  "attack-token.js?v=4": "3511e0da93f25f7919e5552673b4eed670861dfd37a52b9e4752d856b77c1d3f",
  "campaign-data.js?v=0.32": "ac74e35fab1de29654de8822921a529bf1047719ce8dca4dcca5b42516ccce2f",
  "campaign-map-data.js?v=0.34": "d6b29c4aa5cdff295b5acfd5755de849adc148e0be2a6407b21928ff8a373f65",
  "campaign-map.css?v=0.34": "de92506398f190c57e091adb6253437b8a59b630e345c41b5b3c55436a415b0b",
  "campaign-map.js?v=0.34": "298f97d5dafeb4549489afe5ebc16668255678d18af11da278a70d3a0986e310",
  "campaign-routes.js": "aa7ff63cb9abe1e2f7c857889a349c8c2fef7f8f27de843a90274eb305ed18a0",
  "campaign-ui.js?v=0.34": "70b62adf4b784a6071a55d25694f20a72d5225271c0bcd7b5a76b4951eaaa1e6",
  "campaign.css?v=0.34.1": "79fb902cb7e1c9150df1389271376126c8d12b0fcc77bff8a4c933d554bb8174",
  "campaign.js?v=0.32": "ccd0fc3e856ad8e6ffbd8eaa08d51fd8aeb4c88c7f52f47d0365eb23bc9585ef",
  "card-effects-data.js?v=0.29": "ca3106224356f48c15c538d50c837abebe2e347bc7f2afcfaf228bc79ecf1131",
  "card-effects.css?v=0.29": "624e08d312f0890ea5bb2b8c04ebddcbc4388c6bd655f914d77092eb28815501",
  "card-effects.js?v=0.29": "71e5817f07f064467e4023074091b7f5a27a1a2213f05cabcc22fc9f605469bc",
  "card-presentation.js?v=0.29": "adcf5bdaa25df1289dad3c4e9bca0455ec0ce1cac95e9de84f72752d29333612",
  "cards.js?v=0.30": "f90d8734ef640e0e7a13fcc0f5663514c3a53106d3dce124190b5fb0794f5791",
  "champion-cinematic.css": "86c855fc828f3f129e72f7574620de0f7957149ee6846393972691ea33c4cac2",
  "champion-cinematic.js?v=0.30.1": "e5065c8e9897c83b1dc165a082ec02588efaae128052003ef8ac9f9ab60da2eb",
  "champion-presentation.js?v=0.30.1": "bfa014dbeb5d0bb017e6bb961721634563b139b5c92eac12c8e85429ff203909",
  "champions.css": "b326c7dbe2285da83fa419947ae7327caa17564eff93a6626854aa530edcd474",
  "champions.js?v=0.29": "70d549d9101fa3781251d17fdb3202f18c3bd3c82691bc7520856f3af78a41ef",
  "cinematic-library-data.js?v=0.29": "de6b1dc49faf9bf0b39be8f5a8092e78a366b55eee41699b2d98ef66327140ad",
  "collection.js?v=0.32": "687c61b8845e2eb7b1e890237b9519652faeeaac84257ed1173dffbe88c98b64",
  "combat-clarity.css?v=0.29": "76ffc70acde41c5f95ac6e0ca3132cb45bb4d40ecfccfaaff46bb5b387a92fc3",
  "combat-motion.js": "534f68f5bd99aa494076d2bd3239b5ee9b08fc397ea0f39247155c2ed58d5ca2",
  "combat-view.js": "fb25c0557f899869db719b0735a918334a434bf817c289f076e02c2763c818de",
  "current-motion-data.js": "a052e360dcd683cfc8d799e3e41fab73d9c63efb7ce81e213f23deef2ddb4709",
  "current-motion.js": "3f88e03147630bbfefeaa6d155ecbbb616ab995e16f450f46cb86741f010ad3c",
  "deck-builder.css?v=0.30": "4fa1a277468515523ddb7a93c5ae29991802fdfa716c0506032a78d5ff7490b5",
  "deck-tools.js?v=0.30": "9fff924e59a5ca1ba222379297aff17c9f93c96126052e628eeb910c61b2276a",
  "duel-outcome.css?v=0.24": "35e2409153fef8593fd9aba400810212b2e005456f9a703fc35ad4dc1b290980",
  "duel-outcome.js?v=0.19": "87982d18110f2f00051261810910f7b11488df48bd6da9f1449ed363dfad2b3a",
  "duel-polish.css?v=names1": "3f2934eab8d2af2b751350469d0b3ae823dee4566c05dd0fb940785edd244a5f",
  "duel-ui.css": "fea227471e2b7d66ad723446a748255e928cab30d7fd950125d072b65a2d3ea3",
  "duel-ui.js": "0b8aae07abf31a38f63e9189b066d401c0440edc75dd8252975c9945a31ed9fa",
  "engine.js?v=0.29": "d9c8cb253c5bd95a158dd3ecff4ca58203d1c9683c36c2ac172ee4602b287b06",
  "game-audio.js": "f51f638ad68d3a8c006607a294fbaec774a5eec44005f2ce12b02348fd7a182e",
  "header.css?v=2": "df73362a1dcfb7c1a04fb44f247abb0cc4be1c365668f60399dbb627966412ba",
  "index.html": "3b1868dcd12ec45fa59c5bb1b8ed75079aee3a4cf4636baca7e9aa3b8f9975ae",
  "initiative-token-data.js": "33a87eef1feec6b26c90100671d574472f7b082a004f4862ac483d952a5151f9",
  "initiative-token.js?v=5": "78c56a1d89bf4d96441833c2577246b47d27c8d292453ffb81fa69f8dcecb0d5",
  "lor-motion-profile.js": "13bdaff711bba7a3a35e79049052a5d04974569010a0777044005722f1b3097e",
  "lor-motion.css": "fb1801c01e94bfe03f16fb4b97272a1553113fdd4805d7de9ea73d1530da5cf1",
  "manifest.webmanifest": "de52afb68e6cb0ef32746bd924f7cfb4957e831d9f08ec6b690c7ae91a38453e",
  "mobile-pwa.css": "95fe5813eefb3ed4e87543f71db78a2f05f08a62e9073d65c803ae9519a06aee",
  "motion-v3.js": "bc4967457440d3bc1d6da26d95ba5c5f2474b1bf2301384bdf92e0524de9fb9c",
  "native-nexus-end-data.js": "3bffa1a7ab54db0385eddb6856a4415f4aeb74bd3631c336affd9f6e46838830",
  "native-outcome-data.js": "512dbb6bc7c3e836ca80ee543e3bff0fcfb79478b84421a879b9cd170b013af8",
  "native-outcome.js": "707161f2c769ef30352bca06dcfe8946317e97745f7119cd9aa11231b0986893",
  "native-sounds-data.js?v=0.28": "07151a6f489905a6d2f05c592a810ad0d3bdd2f3b9353fe0b85db8d7bf417f44",
  "nexus-data.js": "a160db06b6c4db8eaf4a517a4bafa52eb0ffb4a113f698c914445eda2cdd0201",
  "nexus-fallback-data.js?v=0.24": "4aa1d8fe9da9b5ec14277290e7ffec749b85c93f376843e7f3a88c7ffeeb2197",
  "nexus-hud.css?v=0.25": "6ef70589ab2e64652a408d498e3d930e877e93192316379890debc94af80c9db",
  "nexus-view.js?v=0.24": "f0e82d7d09f92f1d4248c83166733528e65dbbadace39a60a51718d8526f2e4e",
  "official-catalog.js": "40bf4a6f61ec27c50b21c106ab8a8b13e00f1160c044539278f93c6325dcc0fd",
  "opponents.js?v=2": "297fcf362f970e3cbccdb5859c937d8eacb34476a9be328ab451aafd644757b0",
  "pwa-artwork.json": "93177cae6a5a614ceaba652c0690ee3a62f8eb4d821a48de3e3b446e87993b52",
  "pwa.js": "227527209780119084b3901ecdd2182989bf597fe72440dfa2acffd2fb3f47bd",
  "regional-audio-data.js": "75bc1e8352f79258c8e224204d2878ba95c932a264c9277a9cc85e8664e9c376",
  "regional-audio.js": "524df162eceae78c500963b000eb33b779d2f30c575d72188621710e0dbdb6e5",
  "riot-deck-code.js": "ccddf45b2d54b95072921502129e4f8733d148d74cdeb72724869b46d5e903ba",
  "spell-presentation.css": "ae58c135f75cdfcfc550076927952001a06f9f788afa9285cad1ab6212555e6c",
  "style.css": "4ee1da0f61f71da4227caeb0e7d3a0922e1fd4d06b7f1bc2670c9a637488d149",
  "video-motion.css": "f0256da635c83c8c2a678d45bd41ce4dfaff39cd095a07186b9e6e4608ea9649",
  "welcome-settings-motion.js?v=0.27": "e68108cda946f711963138cd743329953b5b18835e376ad3cf1e0bcd0b7bb339",
  "welcome.css?v=0.33": "45e5e9f463a79e8f939a37ac3fb27512b44860450aaf7760befefdf8cbfe90be"
};
const ART_VERSION = "38bf862d1b6d";
const base = new URL('./', self.location.href);
const prefix = `lor-pwa-${encodeURIComponent(base.pathname)}-`;
const coreName = prefix + 'core-' + VERSION;
const runtimeName = prefix + 'runtime-' + VERSION;
const artName = prefix + 'art-' + ART_VERSION;
const corePaths = new Set(CORE.map(file => new URL(file, base).pathname));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(coreName);
    const metadata = new URL('__pwa__/core-revisions.json', base);
    const names = (await caches.keys()).filter(name => name.startsWith(prefix + 'core-') && name !== coreName);
    const previous = names.length ? await caches.open(names[names.length - 1]) : null;
    const stored = previous && await previous.match(metadata);
    const oldRevisions = stored ? await stored.json().catch(() => ({})) : {};
    const controller = new AbortController();
    let cursor = 0, completed = 0;
    async function progress() {
      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of clients)
          if (client.url.startsWith(base.href)) client.postMessage({ type: 'LOR_OFFLINE_PROGRESS', scope: base.pathname, completed, total: CORE.length });
      } catch {} // Closing the window cannot invalidate an otherwise complete cache.
    }
    const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      try {
        while (cursor < CORE.length && !controller.signal.aborted) {
          const file = CORE[cursor++], url = new URL(file, base);
          const unchanged = previous && oldRevisions[file] === REVISIONS[file];
          const reused = unchanged && await previous.match(url);
          const response = reused || await fetch(url, { cache: 'reload', signal: controller.signal });
          if (!response.ok) throw Error(`Offline resource unavailable: ${url.pathname}`);
          await cache.put(url, response);
          completed++;
          if (completed % 5 === 0 || completed === CORE.length) await progress();
        }
      } catch (error) { controller.abort(); throw error; }
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) { await caches.delete(coreName); throw failure.reason; }
    await cache.put(metadata, Response.json(REVISIONS));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([coreName, runtimeName, artName]);
    for (const key of await caches.keys())
      if (key.startsWith(prefix) && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});
// Serialize writes so the automatic image cache stays bounded under concurrency.
let writes = Promise.resolve();
function remember(request, response) {
  const copy = response.clone();
  writes = writes.catch(() => {}).then(async () => {
    const cache = await caches.open(runtimeName);
    await cache.put(request, copy);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - 48))) await cache.delete(key);
  });
  return writes.catch(() => {}); // Quota errors must never break gameplay.
}
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  // Safari media uses byte ranges. Do not cache partial audio/video responses.
  if (request.headers.has('range') || ['audio', 'video'].includes(request.destination)) return;
  // The optional downloader writes its own persistent cache without duplication.
  if (request.headers.has('X-PWA-Artwork')) return;
  if (request.mode === 'navigate' || corePaths.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(coreName);
      const cached = await cache.match(request.mode === 'navigate' ? new URL('index.html', base) : request, { ignoreSearch: true });
      return cached || fetch(request);
    })());
    return;
  }
  if (!url.pathname.startsWith(new URL('assets/', base).pathname) || !/\.(png|webp|jpg|jpeg|svg)$/i.test(url.pathname)) return;
  let fetchedFromNetwork = false;
  const network = (async () => {
    const art = await caches.open(artName);
    const runtime = await caches.open(runtimeName);
    const cached = await art.match(request) || await runtime.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.status === 200) { fetchedFromNetwork = true; return response; }
      throw Error('Image unavailable');
    } catch {
      // Let the card view show its live name/cost/stats over the offline artwork.
      return new Response('', { status: 503, statusText: 'Image not saved offline' });
    }
  })();
  event.respondWith(network);
  // Register lifetime work synchronously, even when network/cache lookups await.
  event.waitUntil(network.then(response => {
    const bytes = Number(response.headers.get('content-length'));
    if (fetchedFromNetwork && response.ok && bytes > 0 && bytes <= 2 * 1048576)
      return remember(request, response);
  }).catch(() => {}));
});
