-- Leaderboard view: per (group, user) total points and category breakdown.
--
-- Scoring rules:
--   team       : full points if prediction.team_id matches result.team_id.
--   team_set   : points_per_unit * |intersection(prediction.team_set, result.team_set)|
--                (no order, partial credit).
--   player     : full points if normalized(player_text) matches.
--
-- Categories where results.* is NULL (not yet resolved) contribute 0 points.

CREATE OR REPLACE VIEW v_user_scores AS
WITH per_category AS (
  SELECT
    p.user_id,
    p.group_id,
    p.category_id,
    c.value_kind,
    gc.points AS points_per_unit,
    CASE
      WHEN NOT gc.enabled THEN 0
      WHEN c.value_kind = 'team'
        AND r.team_id IS NOT NULL
        AND p.team_id = r.team_id
        THEN gc.points
      WHEN c.value_kind = 'team_set'
        AND r.team_set IS NOT NULL
        AND p.team_set IS NOT NULL
        THEN gc.points * (
          SELECT COUNT(*)::int
          FROM jsonb_array_elements_text(p.team_set) pred
          WHERE pred IN (SELECT jsonb_array_elements_text(r.team_set))
        )
      WHEN c.value_kind = 'player'
        AND r.player_text IS NOT NULL
        AND p.player_text IS NOT NULL
        AND lower(regexp_replace(p.player_text, '[^a-z0-9]', '', 'gi'))
          = lower(regexp_replace(r.player_text, '[^a-z0-9]', '', 'gi'))
        THEN gc.points
      ELSE 0
    END AS earned_points
  FROM predictions p
  JOIN categories c ON c.id = p.category_id
  JOIN group_categories gc
    ON gc.group_id = p.group_id AND gc.category_id = p.category_id
  LEFT JOIN results r ON r.category_id = p.category_id
)
SELECT
  group_id,
  user_id,
  SUM(earned_points)::int AS total_points,
  jsonb_object_agg(category_id, earned_points) AS breakdown
FROM per_category
GROUP BY group_id, user_id;
