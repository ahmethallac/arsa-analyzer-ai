import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cities, getDistricts } from '@/data/turkey-cities';
import type { LocationData } from '@/types/analysis';
interface LocationFormProps {
  value: LocationData;
  onChange: (data: LocationData) => void;
}
export function LocationForm({
  value,
  onChange
}: LocationFormProps) {
  const [districts, setDistricts] = useState<string[]>([]);
  useEffect(() => {
    if (value.city) {
      setDistricts(getDistricts(value.city));
    } else {
      setDistricts([]);
    }
  }, [value.city]);
  const handleCityChange = (city: string) => {
    onChange({
      ...value,
      city,
      district: ''
    });
  };
  return <div className="space-y-6">
      <div className="flex items-center gap-2 text-primary">
        <MapPin className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Arazi Bilgileri</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* City */}
        <div className="space-y-2">
          <Label htmlFor="city">
            Şehir <span className="text-destructive">*</span>
          </Label>
          <Select value={value.city} onValueChange={handleCityChange}>
            <SelectTrigger id="city">
              <SelectValue placeholder="Şehir seçin" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {cities.map(city => <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* District */}
        <div className="space-y-2">
          <Label htmlFor="district">
            İlçe <span className="text-destructive">*</span>
          </Label>
          <Select value={value.district} onValueChange={district => onChange({
          ...value,
          district
        })} disabled={!value.city}>
            <SelectTrigger id="district">
              <SelectValue placeholder={value.city ? 'İlçe seçin' : 'Önce şehir seçin'} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {districts.map(district => <SelectItem key={district} value={district}>
                  {district}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Neighborhood */}
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Mahalle</Label>
          <Input id="neighborhood" value={value.neighborhood} onChange={e => onChange({
          ...value,
          neighborhood: e.target.value
        })} placeholder="Örn: Atatürk Mahallesi" />
        </div>

        {/* Block (Ada) */}
        <div className="space-y-2">
          <Label htmlFor="block">
            Ada No <span className="text-destructive">*</span>
          </Label>
          <Input id="block" value={value.block} onChange={e => onChange({
          ...value,
          block: e.target.value
        })} placeholder="Örn: 1234" />
        </div>

        {/* Parcel */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="parcel">
            Parsel No <span className="text-destructive">*</span>
          </Label>
          <Input id="parcel" value={value.parcel} onChange={e => onChange({
          ...value,
          parcel: e.target.value
        })} placeholder="Örn: 56" />
        </div>
      </div>
    </div>;
}