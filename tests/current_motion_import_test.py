"""Decoder tests independent of DOM adapters."""
import importlib.util
import pathlib
import struct
import unittest

spec = importlib.util.spec_from_file_location("current_motion", pathlib.Path(__file__).parents[1]/"tools/import_current_motion.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DecoderTests(unittest.TestCase):
    def test_streamed_cubic_coefficients_are_not_linear_keys(self):
        raw = struct.pack("<fiiffff", 0.0, 1, 0, 2.0, 3.0, 5.0, 7.0)
        words = struct.unpack("<"+"I"*(len(raw)//4), raw)
        self.assertEqual(module.stream_curves(words,1),[[[0.0,2.0,3.0,5.0,7.0]]])
        fake = {"m_MuscleClip":{"m_StartTime":0,"m_StopTime":1,"m_Clip":{"data":{"m_StreamedClip":{"data":words,"curveCount":1},"m_DenseClip":{"m_CurveCount":0,"m_FrameCount":0,"m_SampleArray":[]},"m_ConstantClip":{"data":[]}}}},"m_ClipBindingConstant":{"genericBindings":[{"typeID":23,"attribute":100}]}}
        clip = module.Clip(fake)
        self.assertEqual(clip.value(0,.5),10.5)

    def test_dense_frame_major_interpolation_and_constant_offset(self):
        fake = {"m_MuscleClip":{"m_StartTime":0,"m_StopTime":1,"m_Clip":{"data":{"m_StreamedClip":{"data":[],"curveCount":0},"m_DenseClip":{"m_CurveCount":2,"m_FrameCount":2,"m_SampleArray":[1,10,3,30],"m_BeginTime":0,"m_SampleRate":1},"m_ConstantClip":{"data":[9]}}}},"m_ClipBindingConstant":{"genericBindings":[{"typeID":4,"attribute":1}]}}
        clip = module.Clip(fake)
        self.assertEqual([clip.value(i,.5) for i in range(3)],[2,20,9])


if __name__ == "__main__":
    unittest.main()
