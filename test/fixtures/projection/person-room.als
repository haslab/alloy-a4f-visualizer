sig Person {
    knows: set Person,
    partner: Person -> Room,
    visits: set Room
}

sig Unregistered, Registered extends Person {
	history : set Room
}
sig Active in Unregistered + Registered {
	owns : set Room
}

sig Room {
	next : Room
}

fact Relations {
    all person: Person | person.knows = Person - person
    one person: Person | person.visits = Room
}

run {} for exactly 3 Person, exactly 2 Room
