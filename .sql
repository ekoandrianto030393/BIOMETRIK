SELECT 
    k.id_karyawan,
    k.nama,
    YEAR(a.waktu_absensi) AS Tahun,
    MONTH(a.waktu_absensi) AS Bulan,
    SUM(a.jam_kerja) AS Total_Jam_Kerja
FROM 
    absensi a
JOIN 
    karyawan k ON a.id_karyawan = k.id_karyawan
WHERE 
    a.tipe_absensi = 'PULANG'
GROUP BY 
    k.id_karyawan, 
    k.nama, 
    YEAR(a.waktu_absensi), 
    MONTH(a.waktu_absensi)
ORDER BY
    k.id_karyawan, Tahun DESC, Bulan DESC