window.LOR_MOTION_PROFILE = {
  version: 4,
  source: "research/local-motion-records.json",
  videoReference: "research/video-reference.json",
  observed: {
    unitRevealFixedMs: 833.333333333333,
    drawFromDeckFixedMs: 1000,
    drawToHandFixedMs: 1000,
    opponentDrawFixedMs: 416.666666666667,
    handRevealFixedMs: 83.3333333333333,
    editorFrameRate: 60,
    damageOffsetsMs: {
      cast: 0,
      missile: 100,
      impact: 200,
    },
  },
  adapted: {
    drawRevealMs: 350,
    drawToHandMs: 280,
    unitTravelMs: 260,
    strikeWindupMs: 90,
    strikeTravelMs: 125,
    strikeReturnMs: 190,
    strikeGapMs: 80,
    strikeHitStopMs: 45,
    nexusTravelMs: 240,
    combatReturnMs: 260,
    deathMs: 380,
  },
  limitation:
    "Observed fixed-duration fields and display offsets are reference values, not measured complete animation durations. Adapted browser timings are explicitly separate.",
};
