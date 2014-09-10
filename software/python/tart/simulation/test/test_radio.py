import unittest

import numpy as np
import datetime
import matplotlib.pyplot as plt

from tart.operation import settings
from tart.simulation import simulation_source
from tart.simulation import antennas
from tart.simulation import spectrum
from tart.imaging import antenna_model
from tart.util import angle

from tart.simulation.radio import *



class TestMax2769B(unittest.TestCase):
  def setUp(self):
    self.config = settings.Settings('test_telescope_config.json')
    # noiselvls =  0.1.*np.ones(config.num_antennas)
    noiselvls =  0. * np.ones(self.config.num_antennas)
    self.rad = Max2769B(sample_duration = 1.0e-3, noise_level = noiselvls)
    self.sources = [simulation_source.SimulationSource(amplitude = 1.0, azimuth = angle.from_dms(0.), elevation = angle.from_dms(90.), sample_duration = self.rad.sample_duration)]
    self.ants = [antennas.Antenna(self.config.get_loc(), pos) for pos in self.config.ant_positions]
    self.ant_models = [antenna_model.GpsPatchAntenna() for i in range(self.config.num_antennas)]
    self.utc_date = datetime.datetime.utcnow()

  def test_get_obs(self):

    plt.figure()
    ant_sigs = antennas.antennas_signal(self.ants, self.ant_models, self.sources, self.rad.timebase)
    rad_sig_full = self.rad.sampled_signal(ant_sigs[0, :], 0)
    obs_full = self.rad.get_full_obs(ant_sigs, self.utc_date, self.config)

    ant_sigs_simp = antennas.antennas_simplified_signal(self.ants, self.ant_models, self.sources, self.rad.baseband_timebase, self.rad.int_freq)
    obs_simp = self.rad.get_simplified_obs(ant_sigs_simp, self.utc_date, self.config)


    freqs, spec_full_before_obs = spectrum.plotSpectrum(rad_sig_full, self.rad.ref_freq, label='full_before_obs_obj', c='blue')
    freqs, spec_full = spectrum.plotSpectrum(obs_full.get_antenna(1), self.rad.ref_freq, label='full', c='cyan')
    freqs, spec_simp = spectrum.plotSpectrum(obs_simp.get_antenna(1), self.rad.ref_freq, label='simp', c='red')
    plt.legend()

    self.assertTrue((spec_full_before_obs == spec_full).all(), True)


    plt.figure()
    plt.plot(freqs, (spec_simp-spec_full)/spec_full)
    plt.show()

    print len(obs_full.get_antenna(1)), obs_full.get_antenna(1).mean()
    print len(obs_simp.get_antenna(1)), obs_simp.get_antenna(1).mean()

    # self.assertEqual(self.settings.num_antennas, 5)
    # self.assertLess(d.std(), 0.1)

if __name__ == '__main__':

    a = TestMax2769B()
    a.test_get_obs()

