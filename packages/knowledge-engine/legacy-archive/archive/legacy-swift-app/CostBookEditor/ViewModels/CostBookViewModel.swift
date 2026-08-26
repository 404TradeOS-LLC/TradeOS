import SwiftUI
import Observation

enum AppTab {
    case dashboard
    case items
    case assemblies
    case inbox
}

@Observable
class CostBookViewModel {
    var selectedTab: AppTab = .dashboard
    var items: [CostBookItem] = []
    var assemblies: [Assembly] = []
    var rawInboxItems: [CostBookItem] = []
    
    var alertMessage: String = ""
    var isShowingAlert: Bool = false
    
    // For navigation/selection state
    var selectedItem: CostBookItem?
    var selectedAssembly: Assembly?
    
    init() {
        loadData()
    }
    
    func loadData() {
        let payload = FileService.loadWorkingSet()
        self.items = payload.items
        self.assemblies = payload.assemblies
        self.rawInboxItems = FileService.loadRawInbox()
    }
    
    func saveWorkingSet() {
        do {
            let normalizedItems = NormalizationService.normalize(collection: items)
            // Just update local copies with normalized ones
            self.items = normalizedItems
            
            let payload = Payload(items: self.items, assemblies: self.assemblies)
            try FileService.saveWorkingSet(payload: payload)
            showAlert(message: "Successfully saved to working dataset.")
        } catch {
            showAlert(message: "Failed to save: \(error.localizedDescription)")
        }
    }
    
    func export() {
        do {
            // Re-validate everything before export
            for item in items {
                try ValidationService.validate(item: item, existingItems: items)
            }
            let payload = Payload(items: items, assemblies: assemblies)
            try FileService.exportPayload(payload: payload)
            showAlert(message: "Export Successful!")
        } catch {
            showAlert(message: "Export Failed: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Inbox Actions
    func approve(item: CostBookItem) {
        do {
            try ValidationService.validate(item: item, existingItems: items)
            let normalized = NormalizationService.normalize(item: item)
            items.append(normalized)
            rawInboxItems.removeAll { $0.id == item.id }
            FileService.updateRawInbox(items: rawInboxItems)
            try FileService.saveWorkingSet(payload: Payload(items: items, assemblies: assemblies))
        } catch {
            showAlert(message: "Cannot approve item: \(error.localizedDescription)")
        }
    }
    
    func reject(item: CostBookItem) {
        rawInboxItems.removeAll { $0.id == item.id }
        FileService.updateRawInbox(items: rawInboxItems)
    }
    
    // MARK: - Helpers
    func showAlert(message: String) {
        self.alertMessage = message
        self.isShowingAlert = true
    }
    
    func deleteItems(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
    }
    
    func deleteAssemblies(at offsets: IndexSet) {
        assemblies.remove(atOffsets: offsets)
    }
    
    func publishToProduction() {
        do {
            let payload = Payload(items: items, assemblies: assemblies)
            let sql = SyncService.generateFinalSQL(payload: payload)
            
            let fileURL = FileService.projectRoot.appendingPathComponent("../scratch/sync_final.sql").standardized
            try sql.write(to: fileURL, atomically: true, encoding: .utf8)
            
            showAlert(message: "Production Deployment Ready! SQL transaction generated at scratch/sync_final.sql")
        } catch {
            showAlert(message: "Publish Failed: \(error.localizedDescription)")
        }
    }
}
