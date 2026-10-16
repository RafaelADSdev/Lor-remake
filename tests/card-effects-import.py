import importlib.util
import pathlib
import struct
import unittest

SPEC = importlib.util.spec_from_file_location('effects_import', pathlib.Path(__file__).parents[1] / 'tools/import_card_effects.py')
effects = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(effects)


class CardEffectsImportTests(unittest.TestCase):
    def test_phases_preserve_cast_missile_impact_and_death(self):
        self.assertEqual(effects.phases('Tibbers_Summon_Cast'), ['summon', 'cast'])
        self.assertEqual(effects.phases('FluftofPoros_LastBreath_Missile'), ['death', 'missile'])
        self.assertEqual(effects.phases('Champ_Garen_LevelUp_Impact'), ['levelup', 'impact'])
        self.assertEqual(effects.phases('Attack_Strike_Hit'), ['attack', 'impact'])

    def test_reference_identity_keeps_64_bit_path_ids_and_external_file(self):
        record = {'assetFile': 'CAB-LOCAL'}
        assets = {'cab-local': {'externals': ['archive:/CAB-EXTERNAL/CAB-EXTERNAL']}}
        ref = {'m_FileID': 1, 'm_PathID': -8915941225822940435}
        self.assertEqual(effects.resolve_ref(record, ref, assets), ('cab-external', '-8915941225822940435'))
        self.assertIsNone(effects.resolve_ref(record, {'m_FileID': 0, 'm_PathID': 0}, assets))

    def test_source_disabled_flags_remain_distinct_from_the_browser_activation_policy(self):
        self.assertFalse(effects.enabled_link([{'controls': {'m_Enabled': 1, 'PersonalAnimations.Entries[7].Enabled': 0}}]))
        self.assertTrue(effects.enabled_link([{'controls': {'m_Enabled': 1, 'PersonalAnimations.Entries[0].Enabled': 1}}]))

    def test_exact_card_ownership_adapts_local_events_without_reinterpreting_source_flags(self):
        group = {'id': 'Spells/S001/Ruination', 'family': 'Spells', 'classification': 'specific', 'assets': [], 'mapping': {}}
        chain = [{'field': 'AnimationProfile.Content.AnimationAsset', 'controls': {'ContentEnabled': 0, 'PersonalAnimations.Entries[0].ContentEnabled': 0}}]
        profiles = {'profiles': [{'cardCodeCandidateFromFilename': '01SI015', 'links': [{'target': {'containers': [{'path': 'Assets/AssetLibrary/Spells/S001/Ruination/Ruination_Cast.asset'}]}, 'chain': chain}]}]}
        link = effects.build_links({'groups': [group]}, profiles)[group['id']][0]
        self.assertTrue(link['exact'])
        self.assertTrue(link['enabled'])
        self.assertFalse(link['sourceEnabledFlags'])
        self.assertEqual(link['activationPolicy'], 'browser-event-adaptation')
        self.assertEqual(link['sourceControls'], [chain[0]['controls']])
        group['classification'] = 'skin'
        self.assertFalse(effects.build_links({'groups': [group]}, profiles)[group['id']][0]['enabled'])

    def test_hermite_curve_uses_native_slopes_and_step_keys(self):
        curve = [{'time': 0, 'value': 0, 'outSlope': 2}, {'time': 1, 'value': 1, 'inSlope': 0}]
        self.assertAlmostEqual(effects.curve_value(curve, .5), .75)
        self.assertAlmostEqual(effects.curve_value(curve, -1), 0)
        self.assertAlmostEqual(effects.curve_value(curve, 2), 1)

    def test_native_pptr_stream_initial_value_survives_until_first_swap(self):
        blob = b''
        for time, keys in [(-3.4028234663852886e38, [(0, 0, 0, 0, 1), (1, 0, 0, 0, 0)]), (1.1, [(0, 0, 0, 0, 0), (1, 0, 0, 0, 1)]), (float('inf'), [])]:
            blob += struct.pack('<fi', time, len(keys))
            for key in keys:
                blob += struct.pack('<iffff', *key)
        words = list(struct.unpack('<' + 'I'*(len(blob)//4), blob))
        data = {'m_MuscleClip': {'m_StartTime': 0, 'm_StopTime': 1.5, 'm_Clip': {'data': {
            'm_StreamedClip': {'curveCount': 1, 'data': words},
            'm_DenseClip': {'m_CurveCount': 0, 'm_FrameCount': 1, 'm_SampleArray': []}, 'm_ConstantClip': {'data': []}}}},
            'm_ClipBindingConstant': {'genericBindings': [{'typeID': 137, 'attribute': 1, 'path': 0}, {'typeID': 137, 'attribute': 0, 'path': 0, 'isPPtrCurve': 1}]}}
        clip = effects.NativeClip(data)
        self.assertEqual(clip.value(1, 0), 0)
        self.assertEqual(clip.value(1, 1.2), 1)
        self.assertEqual(data['m_MuscleClip']['m_Clip']['data']['m_StreamedClip']['curveCount'], 1, 'The source tree is not mutated')

    def test_coincident_streamed_keys_keep_the_right_hand_value(self):
        blob = struct.pack('<fi', 0, 2) + struct.pack('<iffff', 0, 0, 0, 0, 2) + struct.pack('<iffff', 0, 0, 0, 0, 7) + struct.pack('<fi', float('inf'), 0)
        words = list(struct.unpack('<' + 'I'*(len(blob)//4), blob))
        data = {'m_MuscleClip': {'m_StartTime': 0, 'm_StopTime': 1, 'm_Clip': {'data': {'m_StreamedClip': {'curveCount': 1, 'data': words}, 'm_DenseClip': {'m_CurveCount': 0, 'm_FrameCount': 1, 'm_SampleArray': []}, 'm_ConstantClip': {'data': []}}}}, 'm_ClipBindingConstant': {'genericBindings': [{'typeID': 137, 'attribute': 1, 'path': 0}]}}
        clip = effects.NativeClip(data)
        self.assertEqual(clip.coincident_key_count, 1)
        self.assertEqual(clip.value(0, .5), 7)


if __name__ == '__main__':
    unittest.main()
