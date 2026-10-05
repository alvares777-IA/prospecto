-- Adiciona os novos avatares PNG à tabela avatar
-- Executar com: docker exec -i prospecto-ia-postgres-1 psql -U prospecto -d jogodavida < jogoDaVida/db/seed_avatares_novos.sql

INSERT INTO avatar (codigo, nome, arquivo, ativo) VALUES
  -- Avatares Kaique
  ('KAIQUE', 'Kaique',        '/img/kaique.png', 'S'),
  ('KAIQUE_CRUZ', 'Kaique (Cruz)',     '/img/kaique-cruz.png', 'S'),
  ('KAIQUE_GRAFICO', 'Kaique (Gráfico)', '/img/kaique-grafico.png', 'S'),

  -- Meninas (12)
  ('MENINA_01', 'Menina 01', '/img/menina01.png', 'S'),
  ('MENINA_02', 'Menina 02', '/img/menina02.png', 'S'),
  ('MENINA_03', 'Menina 03', '/img/menina03.png', 'S'),
  ('MENINA_04', 'Menina 04', '/img/menina04.png', 'S'),
  ('MENINA_05', 'Menina 05', '/img/menina05.png', 'S'),
  ('MENINA_06', 'Menina 06', '/img/menina06.png', 'S'),
  ('MENINA_07', 'Menina 07', '/img/menina07.png', 'S'),
  ('MENINA_08', 'Menina 08', '/img/menina08.png', 'S'),
  ('MENINA_09', 'Menina 09', '/img/menina09.png', 'S'),
  ('MENINA_10', 'Menina 10', '/img/menina010.png', 'S'),
  ('MENINA_11', 'Menina 11', '/img/menina011.png', 'S'),
  ('MENINA_12', 'Menina 12', '/img/menina012.png', 'S'),

  -- Meninos (12)
  ('MENINO_01', 'Menino 01', '/img/menino01.png', 'S'),
  ('MENINO_02', 'Menino 02', '/img/menino02.png', 'S'),
  ('MENINO_03', 'Menino 03', '/img/menino03.png', 'S'),
  ('MENINO_04', 'Menino 04', '/img/menino04.png', 'S'),
  ('MENINO_05', 'Menino 05', '/img/menino05.png', 'S'),
  ('MENINO_06', 'Menino 06', '/img/menino06.png', 'S'),
  ('MENINO_07', 'Menino 07', '/img/menino07.png', 'S'),
  ('MENINO_08', 'Menino 08', '/img/menino08.png', 'S'),
  ('MENINO_09', 'Menino 09', '/img/menino09.png', 'S'),
  ('MENINO_10', 'Menino 10', '/img/menino010.png', 'S'),
  ('MENINO_11', 'Menino 11', '/img/menino011.png', 'S'),
  ('MENINO_12', 'Menino 12', '/img/menino012.png', 'S'),

  -- Tio Patinhas
  ('TIO_PATINHAS', 'Tio Patinhas', '/img/tioPatinhas.png', 'S')
ON CONFLICT (codigo) DO NOTHING;
