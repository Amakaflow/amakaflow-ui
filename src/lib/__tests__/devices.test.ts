import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_DEVICES,
  getDeviceById,
  getDevicesByIds,
  getDevicesByCategory,
  getPopularDevices,
  DeviceId,
} from '../devices';

describe('devices', () => {
  describe('AVAILABLE_DEVICES', () => {
    it('should contain device definitions', () => {
      expect(AVAILABLE_DEVICES.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each device', () => {
      AVAILABLE_DEVICES.forEach((device) => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('description');
        expect(device).toHaveProperty('category');
        expect(device).toHaveProperty('format');
        expect(device).toHaveProperty('icon');
        expect(['watch', 'platform', 'equipment', 'tracker', 'app']).toContain(device.category);
      });
    });

    it('should have unique device IDs', () => {
      const ids = AVAILABLE_DEVICES.map((d) => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getDeviceById', () => {
    it('should return device for valid ID', () => {
      const device = getDeviceById('garmin');
      expect(device).toBeDefined();
      expect(device?.id).toBe('garmin');
      expect(device?.name).toBe('Garmin Connect');
    });

    it('should return undefined for invalid ID', () => {
      const device = getDeviceById('invalid-device' as DeviceId);
      expect(device).toBeUndefined();
    });

    it('should return correct device for each available device', () => {
      AVAILABLE_DEVICES.forEach((expectedDevice) => {
        const device = getDeviceById(expectedDevice.id);
        expect(device).toEqual(expectedDevice);
      });
    });
  });

  describe('getDevicesByIds', () => {
    it('should return devices for valid IDs', () => {
      const devices = getDevicesByIds(['garmin', 'apple', 'zwift']);
      expect(devices.length).toBe(3);
      expect(devices.map((d) => d.id)).toContain('garmin');
      expect(devices.map((d) => d.id)).toContain('apple');
      expect(devices.map((d) => d.id)).toContain('zwift');
    });

    it('should filter out invalid IDs', () => {
      const devices = getDevicesByIds(['garmin', 'invalid-device' as DeviceId, 'apple']);
      expect(devices.length).toBe(2);
      expect(devices.map((d) => d.id)).not.toContain('invalid-device');
    });

    it('should return empty array for empty input', () => {
      const devices = getDevicesByIds([]);
      expect(devices).toEqual([]);
    });

    it('should return empty array for all invalid IDs', () => {
      const devices = getDevicesByIds(['invalid1' as DeviceId, 'invalid2' as DeviceId]);
      expect(devices).toEqual([]);
    });
  });

  describe('getDevicesByCategory', () => {
    it('should return devices for watch category', () => {
      const devices = getDevicesByCategory('watch');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.category).toBe('watch');
      });
    });

    it('should return devices for platform category', () => {
      const devices = getDevicesByCategory('platform');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.category).toBe('platform');
      });
    });

    it('should return devices for equipment category', () => {
      const devices = getDevicesByCategory('equipment');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.category).toBe('equipment');
      });
    });

    it('should return devices for tracker category', () => {
      const devices = getDevicesByCategory('tracker');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.category).toBe('tracker');
      });
    });

    it('should return devices for app category', () => {
      const devices = getDevicesByCategory('app');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.category).toBe('app');
      });
    });

    it('should return empty array for non-existent category', () => {
      const devices = getDevicesByCategory('nonexistent' as any);
      expect(devices).toEqual([]);
    });
  });

  describe('android-companion device', () => {
    it('should have android-companion device defined', () => {
      const device = getDeviceById('android-companion');
      expect(device).toBeDefined();
      expect(device?.id).toBe('android-companion');
      expect(device?.name).toBe('Android Companion');
      expect(device?.category).toBe('app');
      expect(device?.exportMethod).toBe('api');
    });

    it('should include android-companion in companion apps', () => {
      const devices = getDevicesByIds(['apple', 'android-companion']);
      expect(devices.length).toBe(2);
      expect(devices.map(d => d.id)).toContain('apple');
      expect(devices.map(d => d.id)).toContain('android-companion');
    });
  });

  describe('getPopularDevices', () => {
    it('should return only popular devices', () => {
      const devices = getPopularDevices();
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach((device) => {
        expect(device.popular).toBe(true);
      });
    });

    it('should return devices with popular flag set', () => {
      const devices = getPopularDevices();
      const allPopularFromSource = AVAILABLE_DEVICES.filter((d) => d.popular);
      expect(devices.length).toBe(allPopularFromSource.length);
    });
  });
});

