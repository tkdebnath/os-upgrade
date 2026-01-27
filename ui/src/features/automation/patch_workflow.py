
import os

file_path = '/Users/tkdebnath/Devnet/swim/ui/src/features/automation/WorkflowEditor.jsx'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Insert after line 284 (index 284)
# Check context
if ')}' in lines[283] and '</div>' in lines[284]:
    # It matches expected location (0-indexed: 283 matches line 284)
    # Wait, line 284 in 1-indexed is index 283.
    # Line 283: `                                                                    )}`
    # Line 284: `                                                                </div>`
    
    insert_code = """                                    {step.step_type === 'ping' && (
                                        <div className="mt-2 flex items-center space-x-4 text-sm">
                                            <div className="flex items-center">
                                                <span className="mr-2 text-gray-600">Retries:</span>
                                                <input
                                                    type="number"
                                                    value={step.config?.retries || 3}
                                                    onChange={(e) => updateStepConfig(index, 'retries', parseInt(e.target.value))}
                                                    className="w-16 px-2 py-1 border rounded text-xs"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <span className="mr-2 text-gray-600">Interval (s):</span>
                                                <input
                                                    type="number"
                                                    value={step.config?.interval || 10}
                                                    onChange={(e) => updateStepConfig(index, 'interval', parseInt(e.target.value))}
                                                    className="w-16 px-2 py-1 border rounded text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}
"""
    # Adjust indentation to match line 283 (which has 68 spaces approx)
    indent = lines[283][:lines[283].find('{')] if '{' in lines[283] else " " * 68
    # Actually line 283 is just `)}`.
    indent = lines[283][:lines[283].find(')')]
    
    # We want to insert AFTER line 284 (index 283).
    lines.insert(284, insert_code)
    
    with open(file_path, 'w') as f:
        f.writelines(lines)
    print("Successfully patched.")
else:
    print("Context mismatch, not patching.")
    print("Line 283:", lines[283])
    print("Line 284:", lines[284])
