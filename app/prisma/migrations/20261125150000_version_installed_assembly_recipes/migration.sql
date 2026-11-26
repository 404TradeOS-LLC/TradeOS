BEGIN;

-- Fail during rollout if the migration connection lacks the privileges
-- needed to backfill every tenant under the existing forced RLS policies.
SET LOCAL row_security = off;

ALTER TABLE public.assemblies
  ADD COLUMN installed_recipe_id text,
  ADD COLUMN installed_recipe_version integer,
  ADD COLUMN installed_at timestamptz,
  ADD CONSTRAINT assemblies_installed_recipe_check CHECK (
    (installed_recipe_id IS NULL AND installed_recipe_version IS NULL AND installed_at IS NULL)
    OR (org_id IS NOT NULL AND installed_recipe_id IS NOT NULL
        AND installed_recipe_version IS NOT NULL AND installed_recipe_version > 0 AND installed_at IS NOT NULL)
  );

ALTER TABLE public.assembly_items ADD COLUMN recipe_component_key text;

-- Freeze the v1 legacy codes and ordered slots at rollout.
CREATE TEMP TABLE assembly_recipe_v1 (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  slot_keys text[] NOT NULL,
  quantities numeric[] NOT NULL
) ON COMMIT DROP;

INSERT INTO assembly_recipe_v1 (id, code, slot_keys, quantities) VALUES
  ('site-excavation', '31 23 16-TOS-001', ARRAY['excavation', 'haul'], ARRAY[1, 1]),
  ('slab-four-inch', '03 30 00-TOS-001', ARRAY['base', 'concrete', 'reinforcing', 'place-finish'], ARRAY[0.0417, 0.01296, 1.05, 1]),
  ('wall-2x4-16oc', '06 11 00-TOS-001', ARRAY['studs', 'plates', 'hardware', 'labor'], ARRAY[0.1031, 0.0344, 1, 1]),
  ('roof-asphalt-shingle', '07 31 13-TOS-001', ARRAY['shingles', 'underlayment', 'starter-ridge', 'flashing', 'labor'], ARRAY[1.1, 1.05, 1, 1, 1]),
  ('vinyl-siding', '07 46 33-TOS-001', ARRAY['housewrap', 'siding', 'trim', 'labor'], ARRAY[1.05, 1.08, 1, 1]),
  ('interior-door', '08 14 16-TOS-001', ARRAY['door', 'hardware', 'casing', 'labor'], ARRAY[1, 1, 1, 1]),
  ('drywall-half-inch', '09 29 00-TOS-001', ARRAY['board', 'finish-materials', 'hang-labor', 'finish-labor'], ARRAY[1.1, 1, 1, 1]),
  ('paint-interior-wall', '09 91 23-TOS-001', ARRAY['paint', 'sundries', 'prep', 'paint-labor'], ARRAY[0.0067, 1, 1, 1]),
  ('lvp-floor', '09 65 19-TOS-001', ARRAY['flooring', 'underlayment', 'transitions', 'labor'], ARRAY[1.1, 1.05, 1, 1]),
  ('baseboard', '06 46 00-TOS-001', ARRAY['trim', 'fasteners', 'labor', 'finish'], ARRAY[1.1, 1, 1, 1]),
  ('receptacle', '26 27 26-TOS-001', ARRAY['device', 'box-wire', 'labor'], ARRAY[1, 1, 1]),
  ('toilet-replace', '22 42 13-TOS-001', ARRAY['fixture', 'connection', 'labor', 'disposal'], ARRAY[1, 1, 1, 1]),
  ('mini-split-single-zone', '23 81 26-TOS-001', ARRAY['equipment', 'lineset', 'install', 'startup'], ARRAY[1, 1, 1, 1]),
  ('deck-pressure-treated', '06 15 00-TOS-001', ARRAY['footings', 'framing', 'decking', 'hardware', 'labor'], ARRAY[1, 1, 1.1, 1, 1]),
  ('tradeos:demo-drywall-stud-bare', '02 41 19.13-TOS-R001', ARRAY['labor_demo_drywall', 'mat_contractor_bags', 'equip_dumpster_disposal', 'mat_poly_dust_containment'], ARRAY[0.024, 0.025, 0.0009, 0.15]),
  ('tradeos:demo-flooring-carpet-pad', '02 41 19.16-TOS-R001', ARRAY['labor_carpet_tearout', 'mat_duct_tape_rolls', 'equip_carpet_disposal'], ARRAY[0.018, 0.0015, 0.0004]),
  ('tradeos:demo-roofing-shingle-tearoff', '02 41 19.13-TOS-R002', ARRAY['labor_roof_tearoff', 'equip_dumpster_roofing', 'mat_tarps_magnetic_sweep'], ARRAY[0.45, 0.135, 0.02]),
  ('tradeos:demo-concrete-slab-4in', '02 41 16.13-TOS-R001', ARRAY['labor_demo_concrete', 'equip_skidsteer_breaker', 'equip_concrete_disposal_ton'], ARRAY[0.05, 0.025, 0.026]),
  ('tradeos:conc-slab-4in-ongrade', '03 30 53-TOS-R001', ARRAY['mat_concrete_3500_readymix', 'mat_aggregate_subbase_crushed_stone', 'mat_vapor_retarder_10mil', 'mat_vapor_barrier_seam_tape', 'labor_place_finish_slab'], ARRAY[0.0133, 0.021, 1.14, 0.095, 0.024]),
  ('tradeos:conc-footing-continuous-16x8', '03 30 00-TOS-R001', ARRAY['mat_concrete_3000_footing', 'mat_rebar_no4_grade60', 'mat_rebar_chairs_dobies', 'mat_keyway_lumber_2x4', 'labor_footing_pour_keyway'], ARRAY[0.0356, 2.22, 0.25, 1.05, 0.1]),
  ('tradeos:conc-wall-cip-8in-8ft', '03 30 00-TOS-R002', ARRAY['mat_concrete_3500_wall', 'mat_rebar_no4_wall_grid', 'equip_formwork_modular_rental', 'mat_form_snap_ties', 'mat_anchor_bolts_half_x_ten', 'labor_wall_form_pour_strip'], ARRAY[0.0259, 1.46, 2, 0.375, 0.021, 0.075]),
  ('tradeos:conc-pier-sonotube-12x48', '03 30 53-TOS-R002', ARRAY['mat_sonotube_12in_form', 'mat_concrete_3500_pier', 'mat_rebar_no4_pier_vert', 'mat_rebar_no3_tie_hoops', 'mat_anchor_jbolt_half_x_twelve', 'labor_pier_tube_pour'], ARRAY[4.2, 0.128, 12.5, 6.9, 1, 0.85]),
  ('tradeos:framing-wall-int-2x4-16oc', '06 11 00-TOS-R001', ARRAY['mat_studs_2x4_spf', 'mat_plates_2x4_spf', 'fast_nails_16d_framing', 'labor_framing_int_wall'], ARRAY[0.115, 0.413, 0.9, 0.022]),
  ('tradeos:framing-wall-ext-2x6-16oc', '06 11 00-TOS-R002', ARRAY['mat_studs_2x6_spf', 'mat_soleplate_2x6_pt', 'mat_top_plates_2x6_spf', 'mat_sill_seal_gasket', 'mat_header_lumber_2x10', 'fast_nails_16d_ext_framing', 'labor_framing_ext_wall'], ARRAY[0.125, 0.138, 0.275, 0.138, 0.08, 1.15, 0.034]),
  ('tradeos:framing-floor-joist-2x10-16oc', '06 11 00-TOS-R003', ARRAY['mat_joists_2x10_spf', 'mat_joist_hangers_simpson', 'fast_nails_16d_joist', 'labor_framing_floor_joists'], ARRAY[0.92, 0.065, 1.25, 0.028]),
  ('tradeos:framing-subfloor-osb-3-4', '06 16 00-TOS-R001', ARRAY['mat_sheathing_34_tg_osb', 'mat_adhesive_subfloor_heavy_duty', 'fast_subfloor_screws_nails', 'labor_install_subfloor'], ARRAY[1.08, 0.012, 1.25, 0.014]),
  ('tradeos:framing-roof-rafter-2x8-16oc', '06 11 00-TOS-R004', ARRAY['mat_rafters_2x8_spf', 'mat_ridge_board_2x10', 'mat_collar_ties_2x4', 'fast_hurricane_clips_simpson', 'fast_nails_16d_rafter', 'labor_framing_roof_rafters'], ARRAY[0.82, 0.055, 0.12, 0.75, 1.1, 0.042]),
  ('tradeos:deck-framing-pt-joist-beam', '06 11 00-TOS-R005', ARRAY['mat_deck_joists_2x8_pt', 'mat_deck_beams_2x10_pt', 'mat_deck_posts_6x6_pt', 'fast_deck_hardware_hangers', 'fast_ledger_structural_screws', 'labor_framing_deck_structure'], ARRAY[0.88, 0.22, 0.05, 0.15, 0.08, 0.065]),
  ('tradeos:deck-surface-pt-5-4x6', '06 15 00-TOS-R001', ARRAY['mat_deck_boards_54x6_pt', 'fast_deck_screws_coated_25', 'labor_install_pt_decking'], ARRAY[2.4, 3.75, 0.045]),
  ('tradeos:deck-surface-composite-grooved', '06 15 00-TOS-R002', ARRAY['mat_deck_boards_composite_grooved', 'fast_hidden_deck_clips_screws', 'mat_butyl_joist_tape', 'labor_install_composite_decking'], ARRAY[2.36, 2.5, 0.82, 0.055]),
  ('tradeos:deck-guardrail-wood-4in-baluster', '06 15 00-TOS-R003', ARRAY['mat_guard_posts_4x4_pt', 'mat_rails_2x4_pt', 'mat_cap_rail_54x6_pt', 'mat_balusters_2x2_pt', 'fast_post_thru_bolts_half_x_eight', 'fast_baluster_deck_screws', 'labor_build_deck_guardrail'], ARRAY[0.2, 2.2, 1.1, 2.4, 0.4, 9.6, 0.35]),
  ('tradeos:roofing-shingles-arch-asphalt', '07 31 13-TOS-R001', ARRAY['mat_shingles_architectural_bundles', 'mat_shingles_starter_strip', 'mat_shingles_hip_ridge_cap', 'fast_roofing_nails_coil_125', 'labor_install_arch_shingles'], ARRAY[3.3, 0.25, 0.15, 360, 0.75]),
  ('tradeos:roofing-underlayment-synthetic', '07 30 00-TOS-R001', ARRAY['mat_underlayment_synthetic_roll', 'fast_plastic_cap_nails_1in', 'labor_install_underlayment'], ARRAY[0.11, 32, 0.12]),
  ('tradeos:roofing-icewater-shield-membrane', '07 30 00-TOS-R002', ARRAY['mat_membrane_ice_water_roll', 'labor_install_ice_water_shield'], ARRAY[0.55, 0.22]),
  ('tradeos:roofing-flashing-drip-edge', '07 62 00-TOS-R001', ARRAY['mat_drip_edge_metal_10ft', 'fast_roofing_nails_drip_edge', 'labor_install_drip_edge'], ARRAY[0.108, 1.15, 0.02]),
  ('tradeos:siding-vinyl-lap-d4', '07 46 33-TOS-R001', ARRAY['mat_siding_vinyl_d4_panels', 'mat_siding_starter_strip', 'mat_siding_jchannel_trim', 'fast_siding_nails_galvanized', 'labor_install_vinyl_siding'], ARRAY[1.1, 0.12, 0.35, 140, 0.85]),
  ('tradeos:siding-fibercement-lap-hardie', '07 46 46-TOS-R001', ARRAY['mat_hardieplank_lap_boards', 'mat_joint_flashing_aluminum', 'fast_siding_nails_hdg_6d', 'mat_sealant_polyurethane_exterior', 'labor_install_hardie_siding'], ARRAY[1.12, 16, 135, 0.35, 1.45]),
  ('tradeos:moisture-barrier-wrb-housewrap', '07 25 00-TOS-R001', ARRAY['mat_housewrap_roll_tyvek', 'mat_seam_tape_tyvek_2in', 'fast_cap_staples_stinger', 'labor_install_housewrap'], ARRAY[0.12, 0.18, 40, 0.18]),
  ('tradeos:insul-batt-fiberglass-r13-2x4', '07 21 16-TOS-R001', ARRAY['mat_insulation_batt_r13_kraft', 'fast_insulation_staples_t50', 'labor_install_batt_insulation'], ARRAY[1.05, 1.25, 0.009]),
  ('tradeos:insul-loosefill-attic-r38', '07 21 26-TOS-R001', ARRAY['mat_insulation_loosefill_r38_bags', 'mat_soffit_vent_baffles', 'mat_attic_depth_rulers', 'equip_insulation_blower_machine', 'labor_blow_attic_insulation'], ARRAY[0.035, 0.03, 0.003, 0.001, 0.012]),
  ('tradeos:door-interior-prehung-hc', '08 14 00-TOS-R001', ARRAY['mat_door_prehung_hc_unit', 'mat_shims_cedar_pack', 'fast_finish_nails_screws_door', 'mat_hardware_knobset_passage', 'labor_hang_interior_door'], ARRAY[1, 0.5, 16, 1, 0.85]),
  ('tradeos:door-exterior-prehung-fiberglass', '08 14 00-TOS-R002', ARRAY['mat_door_ext_fiberglass_prehung', 'mat_sill_flashing_flexible', 'mat_sealant_polyurethane_exterior', 'fast_structural_hinge_screws_3in', 'labor_install_exterior_door'], ARRAY[1, 1, 2, 12, 2.5]),
  ('tradeos:window-vinyl-retrofit-dh', '08 53 13-TOS-R001', ARRAY['mat_window_dh_vinyl_insert', 'mat_sealant_silicone_window', 'mat_foam_low_expansion_window', 'fast_installation_screws_window', 'labor_install_replacement_window'], ARRAY[1, 0.75, 0.5, 6, 1.5]),
  ('tradeos:drywall-wall-half-inch-l4', '09 29 00-TOS-R001', ARRAY['mat_drywall_board_half_wall', 'fast_drywall_screws_125', 'mat_joint_tape_paper', 'mat_joint_compound_bedding', 'mat_joint_compound_finish', 'mat_corner_bead_vinyl_metal', 'labor_hang_tape_finish_wall'], ARRAY[1.1, 1.365, 1.045, 0.044, 0.088, 0.12, 0.05]),
  ('tradeos:drywall-ceiling-half-inch-l4', '09 29 00-TOS-R002', ARRAY['mat_drywall_board_half_ceiling', 'fast_drywall_screws_ceil_125', 'mat_joint_tape_paper_ceil', 'mat_joint_compound_all_ceil', 'equip_panel_lift_rental', 'labor_ceiling_hang_tape_finish'], ARRAY[1.12, 1.575, 1.1, 0.138, 0.001, 0.062]),
  ('tradeos:drywall-typex-5-8-l4', '09 29 00-TOS-R003', ARRAY['mat_drywall_typex_58_board', 'fast_drywall_screws_162', 'mat_joint_tape_paper_fire', 'mat_joint_compound_all_fire', 'labor_hang_tape_typex'], ARRAY[1.1, 1.68, 1.1, 0.138, 0.064]),
  ('tradeos:drywall-patch-repair-12x12', '09 29 00-TOS-R004', ARRAY['mat_drywall_patch_board', 'mat_wood_backer_strips', 'fast_drywall_screws_patch', 'mat_compound_setting_type', 'mat_tape_fiberglass_mesh', 'labor_patch_drywall_hole'], ARRAY[1.5, 2.33, 12, 0.1, 5.5, 1.5]),
  ('tradeos:paint-wall-interior-latex-2coat', '09 91 23-TOS-R001', ARRAY['mat_paint_interior_latex_gal', 'mat_masking_tape_blue_15', 'mat_spackle_prep_tub', 'mat_roller_tray_sleeve', 'labor_paint_walls_2coat'], ARRAY[0.0062, 0.0018, 0.001, 0.0013, 0.016]),
  ('tradeos:paint-drywall-new-primer-2coat', '09 91 23-TOS-R002', ARRAY['mat_primer_pva_drywall_gal', 'mat_paint_interior_latex_gal', 'mat_sanding_screens_pole', 'mat_masking_drops_film', 'labor_paint_new_drywall'], ARRAY[0.0037, 0.0062, 0.001, 0.025, 0.02]),
  ('tradeos:paint-ceiling-interior-flat-2coat', '09 91 23-TOS-R003', ARRAY['mat_paint_ceiling_flat_gal', 'mat_masking_drops_canvas', 'mat_roller_sleeve_half_nap', 'labor_paint_ceilings_2coat'], ARRAY[0.0062, 0.001, 0.0015, 0.018]),
  ('tradeos:paint-trim-interior-enamel-2coat', '09 91 23-TOS-R004', ARRAY['mat_enamel_trim_waterborne_gal', 'mat_caulk_acrylic_painter', 'mat_wood_putty_nail_filler', 'labor_prep_paint_trim'], ARRAY[0.005, 0.035, 0.002, 0.055]),
  ('tradeos:flooring-lvp-clicklock-floating', '09 65 19-TOS-R001', ARRAY['mat_lvp_planks_click_lock', 'mat_poly_vapor_barrier_slab', 'mat_spacers_expansion_lvp', 'labor_install_lvp_flooring'], ARRAY[1.1, 1.14, 0.001, 0.032]),
  ('tradeos:flooring-hardwood-solid-oak-3-4', '09 64 29-TOS-R001', ARRAY['mat_hardwood_oak_34x325', 'mat_underlayment_felt_15lb', 'fast_flooring_cleats_16ga_2in', 'labor_install_solid_hardwood'], ARRAY[1.1, 1.1, 5.5, 0.05]),
  ('tradeos:flooring-carpet-pad-stretch', '09 68 16-TOS-R001', ARRAY['mat_carpet_broadloom_roll', 'mat_carpet_pad_8lb_rebond', 'mat_tack_strip_wood_residential', 'mat_seaming_tape_hotmelt', 'labor_install_carpet_pad'], ARRAY[1.12, 1.05, 0.28, 0.08, 0.024]),
  ('tradeos:tile-floor-porcelain-12x24', '09 30 13-TOS-R001', ARRAY['mat_tile_porcelain_12x24', 'mat_mortar_thinset_modified_50lb', 'mat_grout_sanded_universal_25lb', 'mat_leveling_clips_spacers', 'mat_sealant_silicone_grout_match', 'labor_tile_floor_porcelain'], ARRAY[1.1, 0.024, 0.007, 2, 0.015, 0.1]),
  ('tradeos:tile-underlayment-cement-board-half', '09 28 13-TOS-R001', ARRAY['mat_cement_board_half_3x5', 'mat_mortar_thinset_bed_cbu', 'fast_cbu_screws_alkali_125', 'mat_tape_cbu_alkali_mesh', 'labor_install_cement_board'], ARRAY[1.08, 0.015, 1.85, 0.85, 0.038]),
  ('tradeos:trim-baseboard-paintgrade-4in', '06 42 00-TOS-R001', ARRAY['mat_baseboard_4in_mdf_primed', 'fast_finish_nails_16ga_25', 'labor_install_baseboard'], ARRAY[1.1, 1.5, 0.05]),
  ('tradeos:trim-casing-door-paintgrade', '06 42 00-TOS-R002', ARRAY['mat_door_casing_primed_mdf', 'fast_casing_nails_finish', 'mat_glue_pva_wood', 'labor_install_door_casing'], ARRAY[1.1, 2, 0.005, 0.045]),
  ('tradeos:cabinet-base-kitchen-prehab', '12 35 30-TOS-R001', ARRAY['mat_base_cabinet_unit', 'fast_cabinet_screws_grk_3in', 'fast_face_frame_screws_trim', 'mat_shims_composite_cabinet', 'labor_install_base_cabinets'], ARRAY[1, 4, 4, 0.25, 1.25]),
  ('tradeos:plumb-toilet-replace-2pc-std', '22 42 13-TOS-R001', ARRAY['mat_toilet_2pc_elongated_unit', 'mat_wax_ring_reinforced_sleeve', 'fast_closet_bolts_solid_brass', 'mat_supply_line_braided_ss_toilet', 'mat_sealant_tub_tile_silicone', 'labor_plumber_toilet_replace'], ARRAY[1, 1, 1, 1, 0.1, 1.75]),
  ('tradeos:plumb-faucet-kitchen-pulldown', '22 41 39-TOS-R001', ARRAY['mat_faucet_kitchen_pulldown_unit', 'mat_counterweight_hose_clip', 'mat_escutcheon_deck_plate_8in', 'labor_replace_kitchen_faucet'], ARRAY[1, 1, 1, 1.25]),
  ('tradeos:plumb-sink-kitchen-undermount', '22 41 16-TOS-R001', ARRAY['mat_sink_basin_stainless_double', 'mat_strainer_basket_stainless', 'mat_drain_tubular_waste_ptrap_kit', 'mat_sealant_silicone_structural_clear', 'fast_undermount_epoxy_clips', 'labor_install_undermount_sink'], ARRAY[1, 2, 1, 0.5, 1, 2.75]),
  ('tradeos:plumb-waterheater-electric-50gal', '22 33 00-TOS-R001', ARRAY['equip_water_heater_50gal_electric', 'mat_drain_pan_aluminum_24in', 'mat_ball_valve_shutoff_34', 'mat_flex_connectors_34_stainless', 'mat_tp_valve_pipe_discharge_kit', 'mat_electrical_whip_fmc_10ga', 'labor_replace_electric_water_heater'], ARRAY[1, 1, 1, 2, 1, 1, 3.5]),
  ('tradeos:hvac-minisplit-singlezone-12k', '23 81 26-TOS-R001', ARRAY['equip_minisplit_12k_system', 'mat_lineset_refrigerant_25ft', 'mat_lineset_cover_duct_kit', 'mat_condenser_pad_composite_risers', 'mat_electrical_disconnect_whip_kit', 'mat_cable_interconnect_14_4', 'labor_install_ductless_minisplit'], ARRAY[1, 1, 1, 1, 1, 30, 6.5]),
  ('tradeos:hvac-furnace-gas-replacement', '23 54 00-TOS-R001', ARRAY['equip_gas_furnace_unit_80k', 'mat_gas_flex_connector_kit', 'mat_sheet_metal_plenum_transition', 'mat_vent_pipe_pvc_sch40_kit', 'mat_condensate_drain_tubing_kit', 'labor_replace_gas_furnace'], ARRAY[1, 1, 1, 1, 1, 7]),
  ('tradeos:hvac-thermostat-smart-replace', '23 09 23-TOS-R001', ARRAY['equip_thermostat_smart_unit', 'fast_drywall_anchors_screws_tstat', 'labor_replace_smart_thermostat'], ARRAY[1, 2, 0.75]),
  ('tradeos:elec-receptacle-duplex-tr-15a', '26 27 26-TOS-R001', ARRAY['mat_receptacle_duplex_tr_15a', 'mat_wall_plate_1gang_nylon', 'mat_wire_pigtail_conductors', 'fast_twist_wire_connectors', 'labor_replace_duplex_receptacle'], ARRAY[1, 1, 1.5, 3, 0.25]),
  ('tradeos:elec-switch-singlepole-15a', '26 27 26-TOS-R002', ARRAY['mat_switch_single_pole_15a', 'mat_switch_wall_plate_1gang', 'mat_wire_ground_pigtail_bare', 'fast_wire_nuts_twist_switch', 'labor_replace_wall_switch'], ARRAY[1, 1, 0.5, 2, 0.2]),
  ('tradeos:elec-lighting-wafer-led-6in', '26 51 00-TOS-R001', ARRAY['mat_wafer_led_light_6in', 'mat_fittings_nm_cable_clamp', 'mat_wire_nm_jumper_14_2', 'labor_install_wafer_downlight'], ARRAY[1, 2, 8, 0.6]),
  ('tradeos:elec-circuit-dedicated-20a-50ft', '26 05 19-TOS-R001', ARRAY['equip_breaker_20a_single_pole', 'mat_cable_nmb_12_2_copper', 'fast_cable_staples_insulated', 'mat_nail_safety_plates_steel', 'labor_install_dedicated_circuit'], ARRAY[1, 58, 14, 4, 2.25]),
  ('tradeos:framing-floor-ijoist-19-2oc', '06 11 00-TOS-R006', ARRAY['mat_ijoist_series_1178', 'mat_rimboard_engineered_1178', 'mat_web_stiffeners_plywood', 'mat_squash_blocks_2x4', 'fast_nails_10d_16d_ijoist', 'labor_framing_ijoist_system'], ARRAY[0.675, 0.127, 0.02, 0.08, 0.85, 0.024]),
  ('tradeos:framing-roof-truss-erection-24oc', '06 11 00-TOS-R007', ARRAY['equip_crane_truss_hoist', 'mat_truss_tie_down_clips', 'mat_bracing_lateral_2x4', 'fast_nails_16d_truss_bracing', 'labor_erect_brace_trusses'], ARRAY[0.002, 0.088, 0.35, 0.75, 0.028]),
  ('tradeos:sheathing-wall-osb-7-16', '06 16 00-TOS-R002', ARRAY['mat_osb_sheathing_716_4x8', 'fast_nails_8d_common_sheathing', 'labor_hang_fasten_wall_sheathing'], ARRAY[1.08, 1.22, 0.012]),
  ('tradeos:sheathing-roof-plywood-cdx-1-2', '06 16 00-TOS-R003', ARRAY['mat_plywood_cdx_12_4x8', 'mat_edge_clips_plywood_hclip', 'fast_nails_8d_common_roof_sheath', 'labor_install_roof_sheathing'], ARRAY[1.1, 0.07, 1.25, 0.016]),
  ('tradeos:framing-beam-lvl-2ply-1178', '06 11 00-TOS-R008', ARRAY['mat_lvl_beam_member_1178', 'fast_structural_screws_lvl_sdws', 'fast_column_cap_connectors', 'labor_fabricate_erect_lvl_beam'], ARRAY[2.12, 2.16, 0.1, 0.22]),
  ('tradeos:deck-stairs-wood-stringer-step', '06 15 00-TOS-R004', ARRAY['mat_stringer_lumber_2x12_pt', 'mat_tread_boards_54x6_pt', 'fast_stringer_hangers_lscz', 'fast_deck_screws_treads_25', 'labor_cut_assemble_deck_stairs'], ARRAY[3.55, 6.48, 0.6, 13.2, 0.75]),
  ('tradeos:deck-ledger-attachment-flashing', '06 15 00-TOS-R005', ARRAY['mat_ledger_board_2x10_pt', 'mat_flashing_ledger_zflashing', 'mat_membrane_flashing_butyl', 'fast_structural_ledger_screws', 'mat_sealant_polyurethane_ledger', 'labor_install_deck_ledger'], ARRAY[1.06, 1.08, 1.1, 1.7, 0.05, 0.18]),
  ('tradeos:found-pier-helical-steel', '31 63 00-TOS-R001', ARRAY['mat_helical_pile_lead_section', 'mat_helical_pile_extension', 'mat_helical_pier_bracket_adjustable', 'equip_hydraulic_drive_rig', 'labor_install_helical_pile'], ARRAY[1, 0.5, 1, 0.4, 0.65]),
  ('tradeos:roofing-metal-standing-seam-24ga', '07 41 13-TOS-R001', ARRAY['mat_metal_panels_standing_seam_24ga', 'fast_clips_standing_seam_expansion', 'fast_screws_pancake_head', 'mat_trim_standing_seam_flashing', 'mat_sealant_butyl_tape_metal', 'labor_install_standing_seam'], ARRAY[1.12, 40.5, 81, 12.5, 25, 2.2]),
  ('tradeos:roofing-membrane-epdm-60mil', '07 53 23-TOS-R001', ARRAY['mat_epdm_membrane_60mil_sheet', 'mat_adhesive_epdm_bonding', 'mat_tape_epdm_seam_3in', 'mat_primer_epdm_tape', 'mat_caulk_epdm_lap_sealant', 'labor_install_epdm_membrane'], ARRAY[1.1, 1.8, 11, 0.12, 0.4, 1.1]),
  ('tradeos:roofing-sbs-roll-selfadhered-cap', '07 52 16-TOS-R001', ARRAY['mat_sbs_base_sheet_selfadhered', 'mat_sbs_cap_sheet_granule', 'mat_flashing_cement_sbs_trowel', 'labor_install_sbs_roll_roof'], ARRAY[0.54, 1.12, 0.25, 0.95]),
  ('tradeos:roofing-vent-ridge-shingleover', '07 72 23-TOS-R001', ARRAY['mat_ridge_vent_baffled_4ft', 'fast_roofing_nails_3in_hand', 'mat_sealant_roof_mastic_ridge', 'labor_install_ridge_vent'], ARRAY[1.05, 4.4, 0.04, 0.065]),
  ('tradeos:roofing-flashing-chimney-step-counter', '07 62 00-TOS-R002', ARRAY['mat_step_flashing_aluminum_cards', 'mat_counter_flashing_aluminum', 'mat_sealant_polyurethane_masonry', 'fast_masonry_lead_wedges', 'labor_install_chimney_flashing'], ARRAY[2.64, 1.1, 0.12, 1.2, 0.35]),
  ('tradeos:roofing-flashing-pipe-boot', '07 62 00-TOS-R003', ARRAY['mat_pipe_boot_elastomeric_unit', 'mat_sealant_polyurethane_roof', 'fast_roofing_nails_boot', 'labor_install_pipe_boot'], ARRAY[1, 0.25, 6, 0.3]),
  ('tradeos:roofing-gutters-seamless-aluminum-5in', '07 71 23-TOS-R001', ARRAY['mat_gutter_coil_aluminum_027', 'mat_downspout_aluminum_2x3', 'fast_gutter_hidden_hangers_screw', 'mat_gutter_outlets_endcaps_miters', 'mat_sealant_gutter_thermoplastic', 'equip_seamless_gutter_machine', 'labor_roll_hang_gutters'], ARRAY[1.05, 0.27, 0.54, 0.08, 0.035, 0.01, 0.075]),
  ('tradeos:insul-sprayfoam-closedcell-2in', '07 21 19-TOS-R001', ARRAY['mat_sprayfoam_closedcell_boardfoot', 'mat_masking_poly_film_prep', 'equip_sprayfoam_mobile_rig', 'labor_spray_closedcell_foam'], ARRAY[2.3, 0.15, 0.005, 0.01]),
  ('tradeos:insul-rigidfoam-xps-2in-foundation', '07 21 13-TOS-R001', ARRAY['mat_xps_board_2in_4x8', 'mat_adhesive_foam_panel_poly', 'fast_masonry_insulation_anchors', 'labor_install_foundation_rigid_foam'], ARRAY[1.08, 0.017, 0.172, 0.02]),
  ('tradeos:waterproofing-foundation-spray-bituminous', '07 11 13-TOS-R001', ARRAY['mat_asphalt_waterproofing_coating', 'mat_cove_mortar_hydro', 'equip_airless_bitumen_spray_rig', 'labor_apply_foundation_waterproofing'], ARRAY[0.0392, 0.05, 0.003, 0.008]),
  ('tradeos:demo-roofing-shingle-tearoff-2layers', '02 41 19.13-TOS-R003', ARRAY['labor_roof_tearoff_2layers', 'equip_dumpster_roofing_2layers', 'mat_tarps_magnetic_sweep_2layers'], ARRAY[0.75, 0.265, 0.03]),
  ('tradeos:demo-flooring-tile-porcelain-thinset', '02 41 19.16-TOS-R002', ARRAY['labor_tile_demo_scrape', 'equip_rotary_hammer_chisel', 'equip_tile_debris_disposal', 'mat_contractor_bags_tile'], ARRAY[0.075, 0.015, 0.0028, 0.02]),
  ('tradeos:demo-cabinet-kitchen-base-wall', '02 41 19.23-TOS-R001', ARRAY['labor_cabinet_removal', 'equip_cabinet_disposal_ton', 'mat_floor_runner_protection'], ARRAY[0.25, 0.02, 0.1]),
  ('tradeos:demo-siding-exterior-lap', '02 41 19.19-TOS-R001', ARRAY['labor_siding_demolition', 'equip_siding_disposal_ton', 'mat_ground_tarps_magnetic_sweep_siding'], ARRAY[0.4, 0.085, 0.02]),
  ('tradeos:demo-deck-wood-framing-surface', '02 41 19.16-TOS-R003', ARRAY['labor_deck_demolition', 'equip_deck_disposal_ton', 'mat_sawzall_blades_consumables'], ARRAY[0.05, 0.0075, 0.01]),
  ('tradeos:earthwork-trench-excavation-mini', '31 23 16.13-TOS-R001', ARRAY['labor_excavator_operator', 'labor_grade_trench_helper', 'equip_mini_excavator_3ton'], ARRAY[0.055, 0.045, 0.055]),
  ('tradeos:subbase-aggregate-granular-compaction', '31 23 23.13-TOS-R001', ARRAY['mat_aggregate_crushed_stone_ton', 'labor_place_compact_aggregate', 'equip_vibratory_plate_compactor'], ARRAY[1.95, 0.35, 0.15]),
  ('tradeos:conc-sidewalk-4in-formed-joints', '32 16 13.13-TOS-R001', ARRAY['mat_concrete_4000_sidewalk', 'mat_formwork_2x4_sidewalk', 'mat_expansion_joint_material', 'mat_curing_compound_spray', 'labor_form_pour_finish_sidewalk'], ARRAY[0.0133, 0.15, 0.02, 0.005, 0.04]),
  ('tradeos:conc-driveway-6in-reinforced-4000psi', '32 13 13.13-TOS-R001', ARRAY['mat_concrete_4000_driveway', 'mat_rebar_no4_driveway_grid', 'mat_rebar_chairs_slab_3in', 'mat_formwork_2x6_driveway', 'mat_curing_sealer_driveway', 'labor_driveway_place_finish_saw'], ARRAY[0.02, 1.48, 0.25, 0.06, 0.006, 0.045]),
  ('tradeos:conc-stoop-steps-unit-cip', '03 30 00-TOS-R003', ARRAY['mat_concrete_4000_stoop', 'mat_formwork_stoop_plywood_risers', 'mat_rebar_no4_stoop_cage', 'mat_epoxy_rebar_anchoring', 'labor_form_pour_finish_stoop'], ARRAY[1.75, 1, 42, 0.25, 8]),
  ('tradeos:masonry-cmu-stemwall-8in-reinforced', '04 22 00-TOS-R001', ARRAY['mat_cmu_blocks_8x8x16_hollow', 'mat_mortar_type_s_masonry_bag', 'mat_grout_corefill_concrete', 'mat_rebar_no4_cmu_reinforcing', 'mat_joint_reinforcement_ladder_9ga', 'labor_lay_cmu_grout_stemwall'], ARRAY[1.18, 0.045, 0.0095, 0.65, 0.75, 0.125]),
  ('tradeos:masonry-brick-veneer-residential', '04 21 13.13-TOS-R001', ARRAY['mat_brick_modular_clay_facing', 'mat_mortar_type_n_masonry_bag', 'fast_brick_wall_ties_corrugated', 'mat_thru_wall_flashing_membrane', 'mat_weep_hole_inserts_cellvent', 'labor_lay_brick_veneer'], ARRAY[7.35, 0.05, 0.42, 0.12, 0.05, 0.16]),
  ('tradeos:fence-wood-privacy-6ft-pt', '32 31 19.53-TOS-R001', ARRAY['mat_fence_posts_4x4x8_pt', 'mat_fence_rails_2x4x8_pt', 'mat_fence_pickets_dogear_pt', 'mat_concrete_bagged_post_footing', 'fast_fence_nails_galvanized_ring', 'labor_install_wood_fence'], ARRAY[0.138, 0.413, 2.28, 0.28, 14.5, 0.25]),
  ('tradeos:fence-chainlink-galvanized-4ft', '32 31 13-TOS-R001', ARRAY['mat_chainlink_fabric_4ft_galv', 'mat_top_rail_138_galv', 'mat_line_posts_158x6_galv', 'mat_terminal_posts_238x65_galv', 'mat_concrete_bagged_chainlink', 'mat_chainlink_fittings_hardware_pack', 'labor_install_chainlink_fence'], ARRAY[1.02, 1.05, 0.105, 0.02, 0.22, 1, 0.18]),
  ('kitchen:wall-cabinet-prefab', '12 35 30-TOS-001', ARRAY['wall-cabinet-unit', 'wall-cabinet-fastening-kit', 'wall-cabinet-setting'], ARRAY[1, 1, 1]),
  ('kitchen:laminate-countertop-straight', '12 36 23-TOS-001', ARRAY['laminate-countertop-material', 'laminate-countertop-install'], ARRAY[1, 1]),
  ('openings:window-vinyl-new-construction-flanged', '08 53 13-TOS-002', ARRAY['window-unit', 'window-flashing-kit', 'window-install-labor'], ARRAY[1, 1, 1]),
  ('openings:garage-door-section-steel', '08 36 13-TOS-001', ARRAY['sectional-door-system', 'qualified-door-install'], ARRAY[1, 1]),
  ('appliances:dishwasher-built-in-existing-ready', '11 31 00-TOS-001', ARRAY['dishwasher-appliance', 'dishwasher-connection-kit', 'dishwasher-installer'], ARRAY[1, 1, 1]);

-- The first installer wrote a CSI/NAHB marker before it added the catalog
-- label. Recognize that older marker only for the original starter recipes.
UPDATE public.assemblies AS assembly
SET installed_recipe_id = recipe.id, installed_recipe_version = 1, installed_at = assembly.created_at
FROM assembly_recipe_v1 AS recipe
WHERE assembly.org_id IS NOT NULL
  AND assembly.code = recipe.code
  AND (assembly.description LIKE '% Catalog 2026.09.1; recipe v1; CSI %; NAHB %'
       OR (assembly.is_template AND position(':' in recipe.id) = 0
           AND assembly.description ~ ' CSI [0-9]{2} [^;]+; NAHB '));

-- The old installer wrote every slot in order, starting at 1. Recover the
-- keys only if the complete set of positions and quantities matches v1.
-- Keep edited or incomplete legacy layouts unkeyed for estimator review.
WITH matched_slots AS (
  SELECT assembly.id AS assembly_id, item.id AS item_id, expected.slot_key, expected.position
  FROM public.assemblies AS assembly
  JOIN assembly_recipe_v1 AS recipe ON recipe.id = assembly.installed_recipe_id
  CROSS JOIN LATERAL unnest(recipe.slot_keys, recipe.quantities)
    WITH ORDINALITY AS expected(slot_key, quantity, position)
  JOIN public.assembly_items AS item
    ON item.assembly_id = assembly.id AND item.sort_order = expected.position
   AND item.quantity_per_unit = round(expected.quantity, 4) AND item.cost_item_id IS NOT NULL
), verified_layouts AS (
  SELECT matched.assembly_id
  FROM matched_slots AS matched
  JOIN public.assemblies AS assembly ON assembly.id = matched.assembly_id
  JOIN assembly_recipe_v1 AS recipe ON recipe.id = assembly.installed_recipe_id
  GROUP BY matched.assembly_id, recipe.slot_keys
  HAVING count(DISTINCT matched.position) = cardinality(recipe.slot_keys)
    AND (SELECT count(*) FROM public.assembly_items WHERE assembly_id = matched.assembly_id)
      = cardinality(recipe.slot_keys)
)
UPDATE public.assembly_items AS item
SET recipe_component_key = matched.slot_key
FROM matched_slots AS matched
JOIN verified_layouts AS verified ON verified.assembly_id = matched.assembly_id
WHERE item.id = matched.item_id;

CREATE TABLE public.assembly_recipe_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id uuid NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
  recipe_id text NOT NULL,
  from_version integer NOT NULL CHECK (from_version > 0),
  to_version integer NOT NULL CHECK (to_version > from_version),
  actor_id uuid NOT NULL,
  upgraded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assembly_id, to_version)
);

ALTER TABLE public.assembly_recipe_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assembly_recipe_upgrades FORCE ROW LEVEL SECURITY;

CREATE POLICY assembly_recipe_upgrades_select ON public.assembly_recipe_upgrades
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assemblies parent
    WHERE parent.id = assembly_id AND parent.org_id = (SELECT public.current_app_org_id()))
);

CREATE POLICY assembly_recipe_upgrades_insert ON public.assembly_recipe_upgrades
FOR INSERT WITH CHECK (
  actor_id = (SELECT public.current_app_user_id())
  AND (SELECT public.current_app_can_manage_costbook())
  AND EXISTS (SELECT 1 FROM public.assemblies parent
    WHERE parent.id = assembly_id AND parent.org_id = (SELECT public.current_app_org_id())
      AND parent.installed_recipe_id = recipe_id AND parent.installed_recipe_version = to_version)
);

COMMIT;
