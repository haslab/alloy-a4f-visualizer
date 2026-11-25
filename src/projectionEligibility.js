/** Whether a signature is eligible for Alloy GUI-style projection. */
export function isProjectableType(instance, typeName) {
    const signature = (instance?.types || []).find(type => type.name === typeName)
    const parent = signature && (signature.parent ?? (signature.parents || [])[0])
    return Boolean(signature && parent === 'univ' && signature.isVar !== true)
}
