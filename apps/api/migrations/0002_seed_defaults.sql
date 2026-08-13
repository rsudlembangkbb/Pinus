INSERT OR IGNORE INTO deduction_rules (id, code, name, percentage, description)
VALUES
  ('rule-discipline', 'DISCIPLINE', 'Pembinaan/Hukuman Disiplin', 50, 'Potongan default untuk pembinaan atau hukuman disiplin.'),
  ('rule-leave', 'LONG_LEAVE', 'Cuti >= 1 Bulan', 50, 'Potongan default untuk cuti melahirkan/sakit/besar/haji/lainnya >= 1 bulan.'),
  ('rule-training', 'LONG_TRAINING', 'Diklat > 1 Bulan', 50, 'Potongan default untuk diklat lebih dari 1 bulan.'),
  ('rule-study', 'STUDY_ASSIGNMENT', 'Tugas Belajar', 80, 'Potongan default untuk tugas belajar dengan ketidakhadiran >= 3 hari/minggu.');
