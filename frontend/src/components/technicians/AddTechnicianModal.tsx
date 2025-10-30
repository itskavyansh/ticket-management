import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, User, Mail, Phone, MapPin, Building, Users, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AddTechnicianModalProps {
  onClose: () => void;
  onTechnicianAdded?: (technicianId: string) => void;
}

interface TechnicianFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  maxCapacity: number;
  specialties: string[];
  newSpecialty: string;
}

const departments = [
  'IT Support',
  'Network Admin',
  'Security',
  'Database Admin',
  'Cloud Operations',
  'DevOps',
  'Help Desk'
];

const locations = [
  'Bangalore Office',
  'Mumbai Office',
  'Del