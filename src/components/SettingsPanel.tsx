import { useState } from 'react';
import { getDevicesByCategory, AVAILABLE_DEVICES, Device, DeviceId } from '../lib/devices';
import { User } from '../types/auth';
import { toast } from 'sonner@2.0.3';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  User as UserIcon,
  CreditCard,
  Watch,
  Check,
  ChevronRight,
  Crown,
  Zap,
  Star,
  Plus,
  Search,
  MapPin
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';

interface SettingsPanelProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (user: Partial<User>) => void;
}

export function SettingsPanel({ user, isOpen, onClose, onUpdateUser }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'devices' | 'profile' | 'billing'>('devices');
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [searchQuery, setSearchQuery] = useState('');

  // Location fields
  const [address, setAddress] = useState(user.address || '');
  const [city, setCity] = useState(user.city || '');
  const [state, setState] = useState(user.state || '');
  const [zipCode, setZipCode] = useState(user.zipCode || '');

  const toggleDevice = (deviceId: DeviceId) => {
    const newDevices = user.selectedDevices.includes(deviceId)
      ? user.selectedDevices.filter(d => d !== deviceId)
      : [...user.selectedDevices, deviceId];
    
    onUpdateUser({ selectedDevices: newDevices });
    
    const device = AVAILABLE_DEVICES.find(d => d.id === deviceId);
    toast.success(`${device?.name} ${newDevices.includes(deviceId) ? 'added' : 'removed'}`);
  };

  const saveProfile = () => {
    onUpdateUser({
      name,
      email,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      zipCode: zipCode || undefined,
    });
    toast.success('Profile updated successfully');
  };

  const upgradeToPro = () => {
    onUpdateUser({ subscription: 'pro', billingDate: new Date() });
    toast.success('Upgraded to Pro! Welcome to unlimited workouts 🎉');
  };

  const upgradeToTrainer = () => {
    onUpdateUser({ subscription: 'trainer', billingDate: new Date() });
    toast.success('Upgraded to Trainer Program! 💪');
  };

  const getTierInfo = () => {
    switch (user.subscription) {
      case 'free':
        return {
          name: 'Free',
          icon: Star,
          color: 'text-muted-foreground',
          workouts: `${user.workoutsThisWeek}/1 workouts this week`
        };
      case 'pro':
        return {
          name: 'Pro',
          icon: Zap,
          color: 'text-primary',
          workouts: `${user.workoutsThisWeek} workouts this week (Unlimited)`
        };
      case 'trainer':
        return {
          name: 'Trainer',
          icon: Crown,
          color: 'text-amber-500',
          workouts: `${user.workoutsThisWeek} workouts this week (Unlimited + AI Coach)`
        };
    }
  };

  const tierInfo = getTierInfo();
  const TierIcon = tierInfo.icon;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your devices, profile, and subscription
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* User Info Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={user.subscription === 'free' ? 'secondary' : 'default'}>
                      <TierIcon className={`w-3 h-3 mr-1 ${tierInfo.color}`} />
                      {tierInfo.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{tierInfo.workouts}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'devices'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Devices
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'billing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Billing
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1">Export Destinations</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose where you want to export your workouts
                  </p>
                </div>
                <Badge variant="secondary">
                  {user.selectedDevices.length} selected
                </Badge>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Watches */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Watch className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-medium">Watches</h4>
                </div>
                {getDevicesByCategory('watch')
                  .filter(device => 
                    searchQuery === '' || 
                    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    device.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((device) => (
                    <Card
                      key={device.id}
                      className={`cursor-pointer transition-all ${\n                        user.selectedDevices.includes(device.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleDevice(device.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={user.selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <div className="text-2xl">{device.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{device.name}</span>
                            {device.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{device.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">Format: {device.format}</div>
                        </div>
                        {user.selectedDevices.includes(device.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {/* Training Platforms */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h4 className="font-medium">Training Platforms</h4>
                </div>
                {getDevicesByCategory('platform')
                  .filter(device => 
                    searchQuery === '' || 
                    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    device.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((device) => (
                    <Card
                      key={device.id}
                      className={`cursor-pointer transition-all ${\n                        user.selectedDevices.includes(device.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleDevice(device.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={user.selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <div className="text-2xl">{device.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{device.name}</span>
                            {device.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{device.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">Format: {device.format}</div>
                        </div>
                        {user.selectedDevices.includes(device.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {/* Fitness Trackers */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💪</span>
                  <h4 className="font-medium">Fitness Trackers</h4>
                </div>
                {getDevicesByCategory('tracker')
                  .filter(device => 
                    searchQuery === '' || 
                    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    device.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((device) => (
                    <Card
                      key={device.id}
                      className={`cursor-pointer transition-all ${\n                        user.selectedDevices.includes(device.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleDevice(device.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={user.selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <div className="text-2xl">{device.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{device.name}</span>
                            {device.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{device.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">Format: {device.format}</div>
                        </div>
                        {user.selectedDevices.includes(device.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {/* Equipment */}
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏋️</span>
                  <h4 className="font-medium">Equipment</h4>
                </div>
                {getDevicesByCategory('equipment')
                  .filter(device => 
                    searchQuery === '' || 
                    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    device.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((device) => (
                    <Card
                      key={device.id}
                      className={`cursor-pointer transition-all ${\n                        user.selectedDevices.includes(device.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => toggleDevice(device.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <Checkbox
                          checked={user.selectedDevices.includes(device.id)}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                        <div className="text-2xl">{device.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{device.name}</span>
                            {device.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground">{device.description}</div>
                          <div className="text-xs text-muted-foreground mt-1">Format: {device.format}</div>
                        </div>
                        {user.selectedDevices.includes(device.id) && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-1">Profile Information</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Update your personal details
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Location Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">Location</h3>
                    <p className="text-sm text-muted-foreground">
                      Help us suggest nearby gyms and workout locations
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="settings-address">Street Address</Label>
                    <Input
                      id="settings-address"
                      type="text"
                      placeholder="123 Main St"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="settings-city">City</Label>
                      <Input
                        id="settings-city"
                        type="text"
                        placeholder="New York"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="settings-state">State</Label>
                      <Input
                        id="settings-state"
                        type="text"
                        placeholder="NY"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-zipCode">Zip Code</Label>
                    <Input
                      id="settings-zipCode"
                      type="text"
                      placeholder="10001"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="w-1/2"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={saveProfile} className="w-full">
                Save Changes
              </Button>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Subscription & Billing</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage your subscription plan
                </p>
              </div>

              <div className="space-y-3">
                {/* Free Tier */}
                <Card className={user.subscription === 'free' ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="w-5 h-5" />
                          Free
                        </CardTitle>
                        <CardDescription>Perfect to get started</CardDescription>
                      </div>
                      {user.subscription === 'free' && (
                        <Badge>Current Plan</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">$0/month</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        1 workout export per week
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        All device formats
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        AI exercise mapping
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                {/* Pro Tier */}
                <Card className={user.subscription === 'pro' ? 'border-primary' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-primary" />
                          Pro
                        </CardTitle>
                        <CardDescription>Unlimited workouts</CardDescription>
                      </div>
                      {user.subscription === 'pro' && (
                        <Badge>Current Plan</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">$3.99/month</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Unlimited workout exports
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        All device formats
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Advanced AI mapping
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Priority support
                      </li>
                    </ul>
                    {user.subscription !== 'pro' && user.subscription !== 'trainer' && (
                      <Button onClick={upgradeToPro} className="w-full mt-4">
                        Upgrade to Pro
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Trainer Tier */}
                <Card className={user.subscription === 'trainer' ? 'border-amber-500' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="w-5 h-5 text-amber-500" />
                          Trainer Program
                        </CardTitle>
                        <CardDescription>For coaches & serious athletes</CardDescription>
                      </div>
                      {user.subscription === 'trainer' && (
                        <Badge className="bg-amber-500">Current Plan</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">$29.99/month</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Everything in Pro
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        AI Training Coach
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Program templates
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Client management
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600" />
                        Analytics & insights
                      </li>
                    </ul>
                    {user.subscription !== 'trainer' && (
                      <Button onClick={upgradeToTrainer} className="w-full mt-4 bg-amber-500 hover:bg-amber-600">
                        Upgrade to Trainer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {user.billingDate && user.subscription !== 'free' && (
                <div className="text-sm text-muted-foreground text-center pt-4">
                  Next billing date: {user.billingDate.toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}