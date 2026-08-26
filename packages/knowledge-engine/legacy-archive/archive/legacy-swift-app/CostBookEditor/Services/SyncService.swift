import Foundation

class SyncService {
    
    static func generateFinalSQL(payload: Payload) -> String {
        var sql: [String] = []
        sql.append("-- TradeOS Final Relational Sync")
        sql.append("-- Generated: \(Date().ISO8601Format())")
        sql.append("BEGIN;")
        sql.append("")
        
        // 1. Cost Items
        sql.append("-- 1. UPSERT COST ITEMS")
        sql.append("INSERT INTO public.cost_items (id, name, category, unit, labor_cost, material_cost, equipment_cost, notes)")
        sql.append("VALUES")
        
        var itemValues: [String] = []
        for item in payload.items {
            let escapedName = item.name.replacingOccurrences(of: "'", with: "''")
            let escapedNotes = (item.notes ?? "").replacingOccurrences(of: "'", with: "''")
            let notesStr = escapedNotes.isEmpty ? "NULL" : "'\(escapedNotes)'"
            
            let val = "('\(item.id)', '\(escapedName)', '\(item.category)', '\(item.unit)', \(item.laborCost), \(item.materialCost), \(item.equipmentCost), \(notesStr))"
            itemValues.append(val)
        }
        sql.append(itemValues.joined(separator: ",\n"))
        sql.append("ON CONFLICT (id) DO UPDATE SET")
        sql.append("  name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit,")
        sql.append("  labor_cost = EXCLUDED.labor_cost, material_cost = EXCLUDED.material_cost, equipment_cost = EXCLUDED.equipment_cost,")
        sql.append("  notes = EXCLUDED.notes, updated_at = now();")
        sql.append("")
        
        // 2. Assemblies
        if !payload.assemblies.isEmpty {
            sql.append("-- 2. UPSERT ASSEMBLIES")
            sql.append("INSERT INTO public.assemblies (id, name, category)")
            sql.append("VALUES")
            var assyValues: [String] = []
            for assy in payload.assemblies {
                let escapedName = assy.name.replacingOccurrences(of: "'", with: "''")
                assyValues.append("('\(assy.id)', '\(escapedName)', '\(assy.category)')")
            }
            sql.append(assyValues.joined(separator: ",\n"))
            sql.append("ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = now();")
            sql.append("")
            
            // 3. Line Items
            sql.append("-- 3. SYNC LINE ITEMS")
            let assyIds = payload.assemblies.map { "'\($0.id)'" }.joined(separator: ", ")
            sql.append("DELETE FROM public.assembly_line_items WHERE assembly_id IN (\(assyIds));")
            sql.append("")
            sql.append("INSERT INTO public.assembly_line_items (assembly_id, cost_item_id, quantity)")
            sql.append("VALUES")
            var liValues: [String] = []
            for assy in payload.assemblies {
                for li in assy.lineItems {
                    liValues.append("('\(assy.id)', '\(li.costBookItemId)', \(li.quantity))")
                }
            }
            sql.append(liValues.joined(separator: ",\n") + ";")
        }
        
        sql.append("")
        sql.append("COMMIT;")
        return sql.joined(separator: "\n")
    }
}
