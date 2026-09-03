import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

export const DistrictSelectInput = ({ value, onChange, onDistrictChange, name = "district" }) => {
  const [districts, setDistricts] = useState([]);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchDistricts = async () => {
      try {
        setLoading(true);
        const res = await api.get('/api/reference/districts');
        // Backend returns [{id, name}, ...] (schemas.DistrictOut), not raw strings.
        if (isMounted) setDistricts(res.data || []);
      } catch (err) {
        console.error("Error fetching districts from DB:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDistricts();
    return () => { isMounted = false; };
  }, []);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomInput(true);
      onChange('');
    } else {
      onChange(val);
      if (onDistrictChange) onDistrictChange(val);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (onDistrictChange) onDistrictChange(val);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {!isCustomInput ? (
        <select
          name={name}
          value={value || ''}
          onChange={handleSelectChange}
          disabled={loading}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{loading ? 'Loading Districts...' : '--Select District--'}</option>
          {districts.map((dist) => (
            <option key={dist.id} value={dist.name}>{dist.name}</option>
          ))}
          <option value="__custom__">Other (Type manually)...</option>
        </select>
      ) : (
        <div className="flex w-full gap-1">
          <input
            type="text"
            name={name}
            value={value || ''}
            onChange={handleInputChange}
            placeholder="Type District Name..."
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setIsCustomInput(false)}
            className="text-xs text-blue-600 hover:underline px-1 whitespace-nowrap"
          >
            Dropdown
          </button>
        </div>
      )}
    </div>
  );
};